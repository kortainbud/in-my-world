import "server-only";
import Stripe from "stripe";
import { getPlan, type PlanId } from "@/config/plans";
import { HttpError } from "./auth";
import { id, now, tx } from "./db";
import type { User } from "./models";
import { STRIPE_ENABLED, fulfill, recordPending, type Item } from "./payments";

let client: Stripe | null = null;
function stripe() {
  if (!STRIPE_ENABLED) throw new HttpError(503, "Card payments aren't set up yet.", "payments_unavailable");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/** Creates a hosted Stripe Checkout page for a plan (monthly) or a credit pack (one-off). */
export async function createStripeCheckout(user: User, item: Item, origin: string) {
  const s = stripe();
  const pending = await recordPending({ userId: user.id, provider: "stripe", kind: item.kind, itemId: item.id, amountCents: item.amountCents, currency: "usd", credits: item.credits });
  const metadata = { paymentId: pending.id, userId: user.id, kind: item.kind, itemId: item.id };
  const session = await s.checkout.sessions.create({
    mode: item.kind === "subscription" ? "subscription" : "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: item.amountCents,
          product_data: { name: `In My World — ${item.name}` },
          ...(item.kind === "subscription" ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    client_reference_id: pending.id,
    customer_email: user.email ?? undefined,
    metadata,
    ...(item.kind === "subscription" ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    success_url: `${origin}/studio/billing?checkout=success`,
    cancel_url: `${origin}/studio/billing?checkout=cancelled`,
  });
  await tx((db) => {
    const p = db.payments.find((x) => x.id === pending.id);
    if (p) p.providerRef = session.id;
  });
  if (!session.url) throw new HttpError(502, "Stripe didn't return a checkout page.");
  return session.url;
}

/**
 * Handles a Stripe webhook. The signature is verified with the webhook
 * secret before anything is trusted; fulfilment is idempotent.
 */
export async function handleStripeWebhook(rawBody: string, signature: string | null) {
  const s = stripe();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(rawBody, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    throw new HttpError(400, "Invalid webhook signature.");
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return { handled: false };
    const paymentId = session.metadata?.paymentId;
    await tx((db) => {
      const p = db.payments.find((x) => x.id === paymentId && x.provider === "stripe");
      if (!p) return;
      p.providerRef = session.id;
      fulfill(db, p);
      if (p.kind === "subscription" && typeof session.subscription === "string") {
        const sub = db.subscriptions.find((x) => x.userId === p.userId);
        if (sub) sub.provider = `stripe:${session.subscription}`;
      }
    });
    return { handled: true };
  }

  if (event.type === "invoice.paid") {
    // Monthly renewals: grant the next allowance (the first invoice is covered by checkout.session.completed).
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.billing_reason !== "subscription_cycle") return { handled: false };
    const meta = invoice.parent?.subscription_details?.metadata ?? {};
    const userId = meta.userId;
    const plan = getPlan(meta.itemId as PlanId);
    await tx((db) => {
      const sub = db.subscriptions.find((x) => x.userId === userId);
      if (!sub || db.credits.some((c) => c.note.includes(invoice.id ?? "__"))) return;
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      Object.assign(sub, { planId: plan.id, status: "active", currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString() });
      db.credits.push({ id: id("ctx"), userId: userId!, amount: plan.monthlyCredits, kind: "grant_monthly", note: `${plan.name} plan — monthly allowance (${invoice.id})`, createdAt: now() });
    });
    return { handled: true };
  }

  if (event.type === "customer.subscription.deleted") {
    const subObj = event.data.object as Stripe.Subscription;
    await tx((db) => {
      const sub = db.subscriptions.find((x) => x.provider === `stripe:${subObj.id}`);
      if (sub) Object.assign(sub, { planId: "free", status: "canceled", provider: "none" });
    });
    return { handled: true };
  }

  return { handled: false };
}

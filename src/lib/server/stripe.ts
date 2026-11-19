import "server-only";
import Stripe from "stripe";
import { getPlan, type PlanId } from "@/config/plans";
import { HttpError } from "./auth";
import { findOne, insertDoc, mutateDoc, newId, now } from "./data";
import type { CreditTransaction, Payment, Subscription } from "./models";
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
  await mutateDoc<Payment>("payments", pending.id, (p) => void (p.providerRef = session.id));
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
    const p = paymentId ? await findOne<Payment>("payments", (q) => q.eq("id", paymentId)) : null;
    if (!p || p.provider !== "stripe") return { handled: false };
    await fulfill(p.id, { providerRef: session.id });
    if (p.kind === "subscription" && typeof session.subscription === "string") {
      const ref = `stripe:${session.subscription}`;
      await mutateDoc<Subscription>("subscriptions", p.userId, (sub) => void (sub.provider = ref));
    }
    return { handled: true };
  }

  if (event.type === "invoice.paid") {
    // Monthly renewals: grant the next allowance (the first invoice is covered by checkout.session.completed).
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.billing_reason !== "subscription_cycle") return { handled: false };
    const meta = invoice.parent?.subscription_details?.metadata ?? {};
    const userId = meta.userId;
    const plan = getPlan(meta.itemId as PlanId);
    if (!userId || !invoice.id) return { handled: false };
    const ref = `stripe_invoice:${invoice.id}`;
    if (await findOne<CreditTransaction>("credits", (q) => q.eq("payment_id", ref))) return { handled: true };
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const sub = await mutateDoc<Subscription>("subscriptions", userId, (x) => {
      Object.assign(x, { planId: plan.id, status: "active", currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString() });
    });
    if (!sub) return { handled: false };
    const cid = newId("ctx");
    await insertDoc<CreditTransaction>("credits", cid, { id: cid, userId, amount: plan.monthlyCredits, kind: "grant_monthly", paymentId: ref, note: `${plan.name} plan — monthly allowance (${invoice.id})`, createdAt: now() });
    return { handled: true };
  }

  if (event.type === "customer.subscription.deleted") {
    const subObj = event.data.object as Stripe.Subscription;
    const sub = await findOne<Subscription>("subscriptions", (q) => q.eq("provider", `stripe:${subObj.id}`));
    if (sub) await mutateDoc<Subscription>("subscriptions", sub.userId, (x) => void Object.assign(x, { planId: "free", status: "canceled", provider: "none" }));
    return { handled: true };
  }

  return { handled: false };
}

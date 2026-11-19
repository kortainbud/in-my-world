import { HttpError, requireUser } from "@/lib/server/auth";
import { CREDIT_PACKS, PLANS } from "@/config/plans";
import { id, now, tx } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { paymentProvider, paymentProviders } from "@/lib/server/payments";

export const GET = route(async () => {
  return json({ providers: paymentProviders().map((p) => ({ id: p.id, label: p.label, method: p.method })) });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  const providers = paymentProviders();
  if (!providers.length) throw new HttpError(503, "Payments aren't set up yet. No payment provider is configured.", "payments_unavailable");
  const provider = paymentProvider(String(b.provider));
  if (!provider) throw new HttpError(400, "Choose a payment method.");
  const kind = b.kind === "subscription" ? "subscription" : "credits";
  const item =
    kind === "subscription"
      ? PLANS.filter((p) => p.priceMonthlyCents > 0).map((p) => ({ kind, id: p.id, amountCents: p.priceMonthlyCents, credits: p.monthlyCredits }) as const).find((p) => p.id === b.itemId)
      : CREDIT_PACKS.map((p) => ({ kind, id: p.id, amountCents: p.priceCents, credits: p.credits }) as const).find((p) => p.id === b.itemId);
  if (!item) throw new HttpError(400, "Unknown plan or credit pack.");
  const origin = new URL(req.url).origin;
  const { url, providerRef } = await provider.createCheckout(user, item, `${origin}/studio/billing`);
  await tx((db) => {
    db.payments.push({ id: id("pay"), userId: user.id, provider: provider.id, kind, itemId: item.id, status: "pending", amountCents: item.amountCents, currency: "usd", credits: item.credits, providerRef, createdAt: now() });
  });
  return json({ url });
});

import "server-only";
import { CREDIT_PACKS, PLANS, getPlan, type PlanId } from "@/config/plans";
import { insertDoc, mutateDoc, newId, now } from "./data";
import type { CreditTransaction, Payment, Subscription } from "./models";

/**
 * Payments. Two independent providers:
 *  - stripe: card payments for plans (subscriptions) and credit packs
 *  - solana: USDC or SOL for credit packs, paid straight to the merchant wallet
 * Credits and plan changes are only applied by `fulfill`, which is only called
 * after server-side verification (Stripe webhook signature, or the transaction
 * confirmed on-chain). Client-side success is never trusted.
 */

export const STRIPE_ENABLED = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
export const SOLANA_RECEIVER = process.env.SOLANA_RECEIVER_ADDRESS || "";
export const SOLANA_ENABLED = !!SOLANA_RECEIVER;

export function paymentMethods() {
  return {
    card: STRIPE_ENABLED,
    crypto: SOLANA_ENABLED ? (["USDC", "SOL"] as const) : ([] as const),
  };
}

export interface Item {
  kind: "subscription" | "credits";
  id: string;
  name: string;
  amountCents: number;
  credits: number;
}

export function findItem(kind: string, itemId: string): Item | undefined {
  if (kind === "subscription") {
    const p = PLANS.find((x) => x.id === itemId && x.priceMonthlyCents > 0);
    return p && { kind, id: p.id, name: `${p.name} plan`, amountCents: p.priceMonthlyCents, credits: p.monthlyCredits };
  }
  const c = CREDIT_PACKS.find((x) => x.id === itemId);
  return c && { kind: "credits", id: c.id, name: `${c.credits} credits`, amountCents: c.priceCents, credits: c.credits };
}

/**
 * Applies a verified payment exactly once: the payment flips to succeeded
 * under compare-and-swap, and a unique index allows one purchase credit per
 * payment. Returns false if it was already fulfilled.
 */
export async function fulfill(paymentId: string, patch: Partial<Payment> = {}) {
  let first = false;
  const p = await mutateDoc<Payment>("payments", paymentId, (x) => {
    first = false;
    if (x.status === "succeeded" && x.fulfilledAt) return false;
    Object.assign(x, patch, { status: "succeeded", fulfilledAt: now() });
    first = true;
  });
  if (!p || !first) return false;
  const credit = (c: Omit<CreditTransaction, "id" | "createdAt">) => {
    const id = newId("ctx");
    return insertDoc<CreditTransaction>("credits", id, { ...c, id, createdAt: now() }).catch(() => undefined);
  };
  if (p.kind === "credits") {
    await credit({ userId: p.userId, amount: p.credits, kind: "purchase", paymentId: p.id, note: `Bought ${p.credits} credits (${p.provider === "stripe" ? "card" : p.crypto?.token})` });
  } else {
    const plan = getPlan(p.itemId as PlanId);
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    await mutateDoc<Subscription>("subscriptions", p.userId, (sub) => {
      Object.assign(sub, { planId: plan.id, status: "active", provider: p.provider, currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString() });
    });
    await credit({ userId: p.userId, amount: plan.monthlyCredits, kind: "grant_monthly", paymentId: p.id, note: `${plan.name} plan — monthly allowance` });
  }
  return true;
}

export async function recordPending(p: Omit<Payment, "id" | "createdAt" | "status">) {
  const rec: Payment = { ...p, id: newId("pay"), status: "pending", createdAt: now() };
  return insertDoc("payments", rec.id, rec);
}

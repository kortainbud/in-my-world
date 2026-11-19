import "server-only";
import { CREDIT_PACKS, PLANS, getPlan, type PlanId } from "@/config/plans";
import { id, now, tx } from "./db";
import type { DB, Payment } from "./models";

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

/** Applies a verified payment exactly once. Call inside a tx. */
export function fulfill(db: DB, p: Payment) {
  if (p.status === "succeeded" && p.fulfilledAt) return false;
  p.status = "succeeded";
  p.fulfilledAt = now();
  if (p.kind === "credits") {
    db.credits.push({ id: id("ctx"), userId: p.userId, amount: p.credits, kind: "purchase", paymentId: p.id, note: `Bought ${p.credits} credits (${p.provider === "stripe" ? "card" : p.crypto?.token})`, createdAt: now() });
  } else {
    const sub = db.subscriptions.find((s) => s.userId === p.userId);
    const plan = getPlan(p.itemId as PlanId);
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    if (sub) Object.assign(sub, { planId: plan.id, status: "active", provider: p.provider, currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString() });
    db.credits.push({ id: id("ctx"), userId: p.userId, amount: plan.monthlyCredits, kind: "grant_monthly", paymentId: p.id, note: `${plan.name} plan — monthly allowance`, createdAt: now() });
  }
  return true;
}

export async function recordPending(p: Omit<Payment, "id" | "createdAt" | "status">) {
  return tx((db) => {
    const rec: Payment = { ...p, id: id("pay"), status: "pending", createdAt: now() };
    db.payments.push(rec);
    return rec;
  });
}

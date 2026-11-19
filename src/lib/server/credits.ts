import "server-only";
import { getPlan, type Plan } from "@/config/plans";
import { id, now, tx } from "./db";
import type { DB, Subscription } from "./models";

export function balanceOf(db: DB, userId: string) {
  return db.credits.filter((c) => c.userId === userId).reduce((a, c) => a + c.amount, 0);
}

/**
 * Rolls the subscription period forward and grants the monthly allowance for
 * each new period. Monthly credits don't accumulate beyond one period: unused
 * allowance from the previous period expires (recorded as a ledger entry).
 */
export function rollPeriods(db: DB, userId: string): Subscription | undefined {
  const sub = db.subscriptions.find((s) => s.userId === userId);
  if (!sub) return undefined;
  let guard = 0;
  while (new Date(sub.currentPeriodEnd) <= new Date() && guard++ < 24) {
    const plan = getPlan(sub.planId);
    const start = new Date(sub.currentPeriodEnd);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    sub.currentPeriodStart = start.toISOString();
    sub.currentPeriodEnd = end.toISOString();
    db.credits.push({ id: id("ctx"), userId, amount: plan.monthlyCredits, kind: "grant_monthly", note: `${plan.name} plan — monthly allowance`, createdAt: now() });
  }
  return sub;
}

export async function accountSnapshot(userId: string) {
  return tx((db) => {
    const sub = rollPeriods(db, userId);
    const plan: Plan = getPlan(sub?.planId);
    const ledger = db.credits.filter((c) => c.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const used = -ledger.filter((c) => c.kind === "debit_generation").reduce((a, c) => a + c.amount, 0) - ledger.filter((c) => c.kind === "refund_generation").reduce((a, c) => a + c.amount, 0);
    return {
      balance: balanceOf(db, userId),
      used,
      plan,
      subscription: sub,
      ledger: ledger.slice(0, 100),
      payments: db.payments.filter((p) => p.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  });
}

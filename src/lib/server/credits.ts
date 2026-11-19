import "server-only";
import { getPlan, type Plan } from "@/config/plans";
import { creditBalance, findDocs, getDoc, insertDoc, mutateDoc, newId, now } from "./data";
import type { CreditKind, CreditTransaction, Payment, Subscription } from "./models";

export async function addCredits(userId: string, amount: number, kind: CreditKind, note: string, extra: { jobId?: string; paymentId?: string } = {}) {
  const c: CreditTransaction = { id: newId("ctx"), userId, amount, kind, note, createdAt: now(), ...extra };
  await insertDoc("credits", c.id, c);
  return c;
}

/**
 * Rolls the subscription period forward and grants the monthly allowance for
 * each new period. Stripe-managed subscriptions renew from the webhook.
 */
export async function rollPeriods(userId: string): Promise<Subscription | null> {
  const grants: { amount: number; note: string }[] = [];
  const sub = await mutateDoc<Subscription>("subscriptions", userId, (s) => {
    grants.length = 0;
    if (s.provider.startsWith("stripe:") || new Date(s.currentPeriodEnd) > new Date()) return false;
    let guard = 0;
    while (new Date(s.currentPeriodEnd) <= new Date() && guard++ < 24) {
      const plan = getPlan(s.planId);
      const start = new Date(s.currentPeriodEnd);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      s.currentPeriodStart = start.toISOString();
      s.currentPeriodEnd = end.toISOString();
      grants.push({ amount: plan.monthlyCredits, note: `${plan.name} plan — monthly allowance` });
    }
  });
  for (const gr of grants) await addCredits(userId, gr.amount, "grant_monthly", gr.note);
  return sub;
}

export async function planFor(userId: string): Promise<Plan> {
  const s = await getDoc<Subscription>("subscriptions", userId);
  return getPlan(s?.planId);
}

export async function accountSnapshot(userId: string) {
  const sub = await rollPeriods(userId);
  const plan: Plan = getPlan(sub?.planId);
  const ledger = await findDocs<CreditTransaction>("credits", (q) => q.eq("user_id", userId).order("ts", { ascending: false }).limit(200));
  const used =
    -ledger.filter((c) => c.kind === "debit_generation").reduce((a, c) => a + c.amount, 0) -
    ledger.filter((c) => c.kind === "refund_generation").reduce((a, c) => a + c.amount, 0);
  const payments = await findDocs<Payment>("payments", (q) => q.eq("user_id", userId).order("ts", { ascending: false }).limit(50));
  return { balance: await creditBalance(userId), used, plan, subscription: sub, ledger: ledger.slice(0, 100), payments };
}

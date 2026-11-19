"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CREDIT_PACKS, formatPrice, PLANS, type Plan } from "@/config/plans";
import { api, ApiError, timeAgo } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { CreditTable } from "@/components/credit-table";
import { Button, Notice, Tag } from "@/components/ui";
import { CryptoCheckout } from "@/components/studio/crypto-checkout";
import { PageHeader } from "@/components/studio/shell";

interface Snapshot {
  balance: number;
  used: number;
  plan: Plan;
  subscription?: { currentPeriodEnd: string; provider: string };
  ledger: { id: string; amount: number; kind: string; note: string; createdAt: string; jobId?: string }[];
  payments: { id: string; provider: string; kind: string; itemId: string; status: string; amountCents: number; credits: number; createdAt: string }[];
  history: { jobId: string; projectId: string; title: string; status: string; credits: number; refunded: boolean; createdAt: string }[];
}

const KIND: Record<string, string> = {
  grant_signup: "Plan allowance",
  grant_monthly: "Monthly allowance",
  purchase: "Purchase",
  debit_generation: "Video",
  refund_generation: "Refund",
  dev_grant: "Dev credits",
};

export function BillingScreen() {
  const [s, setS] = useState<Snapshot | null>(null);
  const [msg, setMsg] = useState<{ tone: "danger" | "accent" | "warn"; text: string } | null>(null);
  const { providers, refresh } = useMe();
  const [methods, setMethods] = useState<{ card: boolean; crypto: ("USDC" | "SOL")[] }>({ card: false, crypto: [] });
  const [crypto, setCrypto] = useState<{ pack: { id: string; credits: number }; token: "USDC" | "SOL" } | null>(null);
  useEffect(() => {
    api<{ card: boolean; crypto: ("USDC" | "SOL")[] }>("/api/billing/checkout").then(setMethods).catch(() => undefined);
    const q = new URLSearchParams(window.location.search).get("checkout");
    if (q === "success") setMsg({ tone: "accent", text: "Payment received. Your credits appear as soon as Stripe confirms it — usually within a few seconds." });
    if (q === "cancelled") setMsg({ tone: "warn", text: "Checkout cancelled. Nothing was charged." });
  }, []);

  const load = useCallback(async () => setS(await api<Snapshot>("/api/credits")), []);
  useEffect(() => {
    void load();
  }, [load]);

  const checkout = async (kind: "subscription" | "credits", itemId: string) => {
    setMsg(null);
    try {
      const { url } = await api<{ url: string }>("/api/billing/checkout", { method: "POST", json: { kind, itemId } });
      window.location.assign(url);
    } catch (e) {
      setMsg({ tone: "warn", text: e instanceof ApiError ? e.message : "Checkout isn't available right now." });
    }
  };

  const dev = async (path: string, json: unknown, text: string) => {
    await api(path, { method: "POST", json });
    await load();
    await refresh();
    setMsg({ tone: "accent", text });
  };

  if (!s) return <div className="flex min-h-[50vh] items-center justify-center text-small text-fg-3">Loading…</div>;
  const paymentsReady = methods.card || methods.crypto.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
      <PageHeader title="Credits & billing" sub="Every video has a credit cost shown before you create it. Failed videos are refunded automatically." />
      {msg && <Notice tone={msg.tone} className="mb-6">{msg.text}</Notice>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Available credits" value={s.balance} />
        <Stat label="Used (net of refunds)" value={s.used} />
        <Stat label="Current plan" value={s.plan.name} sub={s.subscription ? `Allowance renews ${new Date(s.subscription.currentPeriodEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : undefined} />
      </div>

      {!paymentsReady && (
        <Notice tone="warn" className="mt-6">
          {providers?.mode === "development" ? (
            <>
              Payments aren’t set up yet — add Stripe keys for cards and/or a Solana receiving address for USDC and SOL. Prices below are placeholders from <code className="font-mono text-caption">src/config/plans.ts</code>.
            </>
          ) : (
            "Upgrades and credit packs open soon. Your free credits refresh every month."
          )}
        </Notice>
      )}

      <h2 className="mb-3 mt-10 text-lead font-semibold tracking-[-0.02em]">Plans</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((p) => {
          const current = p.id === s.plan.id;
          return (
            <div key={p.id} className={`flex flex-col rounded-[16px] border p-5 ${current ? "border-accent" : "border-line-soft"} bg-[var(--card)]`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lead font-semibold">{p.name}</h3>
                {current && <Tag tone="accent">Current</Tag>}
              </div>
              <p className="mt-1 text-small text-fg-2">{p.tagline}</p>
              <p className="mt-4 text-page font-semibold">
                {formatPrice(p.priceMonthlyCents)}
                <span className="text-small font-normal text-fg-3"> /month</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-small text-fg-2">
                <li>{p.monthlyCredits} credits each month</li>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                {current ? (
                  <Button className="w-full" disabled>
                    Your plan
                  </Button>
                ) : p.priceMonthlyCents === 0 ? (
                  <Button className="w-full" disabled title="Downgrades happen through the payment provider’s customer portal.">
                    Free
                  </Button>
                ) : (
                  <Button className="w-full" variant={p.highlighted ? "primary" : "secondary"} onClick={() => checkout("subscription", p.id)} disabled={!methods.card} title={methods.card ? "Pay monthly by card" : "Card payments aren't set up yet"}>
                    Upgrade to {p.name}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-10 text-lead font-semibold tracking-[-0.02em]">Credit packs</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CREDIT_PACKS.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-[16px] border border-line-soft bg-[var(--card)] p-4">
            <div>
              <p className="text-body font-medium">{c.credits} credits</p>
              <p className="text-small text-fg-2">{formatPrice(c.priceCents)} one-off · never expire</p>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {methods.card && (
                <Button size="sm" onClick={() => checkout("credits", c.id)}>
                  Card
                </Button>
              )}
              {methods.crypto.map((t) => (
                <Button key={t} size="sm" onClick={() => setCrypto({ pack: { id: c.id, credits: c.credits }, token: t })}>
                  {t}
                </Button>
              ))}
              {!paymentsReady && (
                <Button size="sm" disabled>
                  Buy
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-caption text-fg-2">Plans renew monthly by card. Credit packs can be paid by card, or with USDC or SOL from any Solana wallet (Phantom, Solflare, Backpack…). Credits are added only after the payment is confirmed on our server.</p>
      <CryptoCheckout pack={crypto?.pack ?? null} token={crypto?.token ?? "USDC"} onClose={() => setCrypto(null)} onPaid={() => { void load(); void refresh(); }} />

      <h2 className="mb-3 mt-10 text-lead font-semibold tracking-[-0.02em]">How credits work</h2>
      <CreditTable />

      {providers?.mode === "development" && (
        <div className="mt-10 rounded-[16px] border border-dashed border-[var(--warn-line)] p-5">
          <p className="text-body font-medium text-warn">Development tools</p>
          <p className="mt-1 text-caption text-fg-2">Only available in development mode. Dev credits are labelled in the ledger and can’t exist in production.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => dev("/api/dev/grant", { amount: 100 }, "Added 100 dev credits.")}>
              Add 100 dev credits
            </Button>
            {PLANS.map((p) => (
              <Button key={p.id} size="sm" variant="ghost" disabled={p.id === s.plan.id} onClick={() => dev("/api/dev/plan", { planId: p.id }, `Switched to ${p.name} (dev).`)}>
                Switch to {p.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lead font-semibold tracking-[-0.02em]">Credit ledger</h2>
          <div className="overflow-hidden rounded-[16px] border border-line-soft">
            <table className="w-full text-left text-small">
              <thead className="bg-bg-2 text-caption text-fg-3">
                <tr>
                  <th className="px-3.5 py-2 font-normal">Entry</th>
                  <th className="px-3.5 py-2 font-normal">When</th>
                  <th className="px-3.5 py-2 text-right font-normal">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {s.ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3.5 py-2.5">
                      <span className="block">{KIND[l.kind] ?? l.kind}</span>
                      <span className="block text-caption text-fg-3">{l.note}</span>
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-fg-2">{timeAgo(l.createdAt)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${l.amount > 0 ? "text-accent" : "text-fg-2"}`}>{l.amount > 0 ? `+${l.amount}` : l.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="space-y-8">
          <div>
            <h2 className="mb-3 text-lead font-semibold tracking-[-0.02em]">Generation history</h2>
            {s.history.length === 0 ? (
              <p className="text-small text-fg-3">No videos yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft rounded-[16px] border border-line-soft">
                {s.history.map((h) => (
                  <li key={h.jobId} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-small">
                    <Link href={`/studio/projects/${h.projectId}`} className="min-w-0 truncate hover:underline">
                      {h.title}
                    </Link>
                    <span className="shrink-0 text-right text-fg-2">
                      {h.credits} cr {h.refunded && <Tag tone="accent">refunded</Tag>} {h.status === "failed" && !h.refunded && <Tag tone="danger">failed</Tag>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="mb-3 text-lead font-semibold tracking-[-0.02em]">Purchase history</h2>
            {s.payments.length === 0 ? (
              <p className="text-small text-fg-3">No purchases yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft rounded-[16px] border border-line-soft">
                {s.payments.map((p) => (
                  <li key={p.id} className="flex justify-between px-3.5 py-2.5 text-small">
                    <span>
                      {p.itemId} · {p.provider}
                    </span>
                    <span className="text-fg-2">
                      {formatPrice(p.amountCents)} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-[16px] border border-line-soft bg-[var(--card)] p-5">
      <p className="text-caption text-fg-2">{label}</p>
      <p className="mt-1 text-page font-semibold">{value}</p>
      {sub && <p className="text-caption text-fg-3">{sub}</p>}
    </div>
  );
}

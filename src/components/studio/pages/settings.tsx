"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { Button, Field, inputCls, Notice, Spinner } from "@/components/ui";
import { WalletButtons } from "@/components/wallet";
import { PageHeader } from "@/components/studio/shell";

export function SettingsScreen() {
  const { me, providers, refresh } = useMe();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "danger" | "accent"; text: string } | null>(null);
  useEffect(() => {
    if (me) {
      setName(me.displayName);
      setHandle(me.handle);
    }
  }, [me]);
  if (!me) return null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12 [&>*]:max-w-[760px]">
      <PageHeader title="Settings" />
      <section className="rounded-[16px] border border-line-soft bg-[var(--card)] p-5">
        <h2 className="text-body font-semibold">Profile</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            try {
              await api("/api/settings/profile", { method: "PATCH", json: { displayName: name, handle } });
              await refresh();
              setMsg({ tone: "accent", text: "Profile saved." });
            } catch (err) {
              setMsg({ tone: "danger", text: err instanceof ApiError ? err.message : "Couldn't save." });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Display name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Handle" hint="Shown on videos you share publicly.">
            <div className="flex items-center">
              <span className="flex h-10 items-center rounded-l-[8px] border border-r-0 border-line bg-bg px-3 text-sm text-fg-3">@</span>
              <input className={`${inputCls} rounded-l-none`} value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} maxLength={20} />
            </div>
          </Field>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Button type="submit" variant="primary" disabled={busy}>
            {busy && <Spinner />} Save profile
          </Button>
        </form>
      </section>

      <section className="mt-4 rounded-[16px] border border-line-soft bg-[var(--card)] p-5">
        <h2 className="text-body font-semibold">Account</h2>
        <p className="mt-2 text-small text-fg-2">{me.email ? `Signed in as ${me.email}` : "This account signs in with a wallet."}</p>
      </section>

      <section className="mt-4 rounded-[16px] border border-line-soft bg-[var(--card)] p-5">
        <h2 className="text-body font-semibold">Wallets</h2>
        <p className="mt-1 text-small leading-relaxed text-fg-2">
          Link a wallet to sign in with it. Linking only proves ownership — it can’t move funds, and we’ll never ask for a seed phrase or private key. Paying with crypto is separate and happens at checkout.
        </p>
        {me.wallets.length > 0 && (
          <ul className="mt-4 divide-y divide-line-soft rounded-[12px] border border-line-soft">
            {me.wallets.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-small">
                <span className="min-w-0">
                  <span className="block font-medium">{w.chain === "solana" ? "Solana wallet" : "Ethereum wallet"}</span>
                  <span className="block truncate font-mono text-caption text-fg-3">{w.address}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await api(`/api/wallet/${w.id}`, { method: "DELETE" });
                      await refresh();
                    } catch (e) {
                      setMsg({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't unlink." });
                    }
                  }}
                >
                  Unlink
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 max-w-sm">
          <WalletButtons purpose="link" onDone={() => void refresh()} />
        </div>
      </section>

      {providers && (
        <section className="mt-4 rounded-[16px] border border-line-soft bg-[var(--card)] p-5">
          <h2 className="text-body font-semibold">Generation engine</h2>
          <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-small">
            <dt className="text-fg-3">Mode</dt>
            <dd>{providers.mode}</dd>
            <dt className="text-fg-3">Story</dt>
            <dd>{providers.story.label}</dd>
            <dt className="text-fg-3">Voice</dt>
            <dd>{providers.voice.label}</dd>
            <dt className="text-fg-3">Rendering</dt>
            <dd>{providers.render.label}</dd>
            <dt className="text-fg-3">Payments</dt>
            <dd>{[providers.payments.card && "Card (Stripe)", providers.payments.crypto && "USDC + SOL (Solana)"].filter(Boolean).join(" · ") || "Not configured"}</dd>
          </dl>
        </section>
      )}
    </div>
  );
}

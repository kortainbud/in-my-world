"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { base58, connectWallet, POPULAR_WALLETS, signText, useSolanaWallets, walletError, type StandardWallet } from "@/lib/client/wallets";
import { Notice, Spinner } from "@/components/ui";

function WalletIcon({ w, size = 24 }: { w: StandardWallet; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={w.icon} alt="" width={size} height={size} className="shrink-0 rounded-[7px]" />;
}

/**
 * "Connect a wallet" button with a dropdown of the Solana wallets installed in
 * this browser (Phantom, Solflare, Backpack, MetaMask…). If none are
 * installed it suggests a few to get.
 */
export function WalletPicker({
  label = "Connect a wallet",
  busy,
  onPick,
  filter,
  className = "",
}: {
  label?: string;
  busy?: string | null;
  onPick: (w: StandardWallet) => void;
  filter?: (w: StandardWallet) => boolean;
  className?: string;
}) {
  const all = useSolanaWallets();
  const wallets = all?.filter(filter ?? (() => true)) ?? null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const installed = new Set(wallets?.map((w) => w.name.toLowerCase()));
  const suggestions = POPULAR_WALLETS.filter((p) => !installed.has(p.name.toLowerCase()));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!!busy}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-line bg-[var(--card)] px-5 text-body font-medium text-fg transition-colors hover:border-[var(--line-strong)] hover:bg-bg-2 disabled:cursor-wait"
      >
        {busy ? (
          <>
            <Spinner /> Check {busy}…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="2" y="4.5" width="14" height="10" rx="2.5" />
              <path d="M2 7.5h11.5a1 1 0 011 1V12" />
              <circle cx="12.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
            </svg>
            {label}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
              <path d="M3 4.5L6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[16px] border border-line bg-[var(--card)] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
          {wallets && wallets.length > 0 && (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-micro font-medium text-fg-2">Installed in this browser</p>
              {wallets.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onPick(w);
                  }}
                  className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left text-body text-fg hover:bg-bg-2"
                >
                  <WalletIcon w={w} />
                  <span className="flex-1 font-medium">{w.name}</span>
                  <span className="text-micro text-fg-2">Detected</span>
                </button>
              ))}
            </>
          )}
          {suggestions.length > 0 && (
            <>
              <p className={`px-2.5 pb-1 text-micro font-medium text-fg-2 ${wallets?.length ? "mt-1 border-t border-line-soft pt-2.5" : "pt-1.5"}`}>
                {wallets?.length ? "Other wallets" : "No wallet found in this browser — get one:"}
              </p>
              {suggestions.map((p) => (
                <a
                  key={p.name}
                  role="menuitem"
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-body text-fg hover:bg-bg-2"
                >
                  <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-bg-3 text-micro font-semibold text-fg">
                    {p.name[0]}
                  </span>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-micro text-fg-2">Install ↗</span>
                </a>
              ))}
            </>
          )}
          <p className="mt-1 border-t border-line-soft px-2.5 pb-1.5 pt-2.5 text-micro leading-relaxed text-fg-2">
            Solana wallets only. After installing, refresh this page.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Wallet identity: sign in with, or link, a Solana wallet by signing a
 * one-time text message. Never requests transactions, seed phrases or keys.
 */
export function WalletButtons({ purpose, onDone }: { purpose: "signin" | "link"; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (w: StandardWallet) => {
    setBusy(w.name);
    setError(null);
    try {
      const account = await connectWallet(w);
      const { nonce, message } = await api<{ nonce: string; message: string }>("/api/wallet/nonce", { method: "POST", json: { chain: "solana", address: account.address, purpose } });
      const signature = base58(await signText(w, account, message));
      await api("/api/wallet/verify", { method: "POST", json: { nonce, signature } });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : walletError(e, "The wallet didn’t respond. Try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <WalletPicker label={purpose === "link" ? "Link a wallet" : "Continue with a wallet"} busy={busy} onPick={run} />
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

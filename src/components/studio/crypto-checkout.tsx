"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Button, Modal, Notice, Spinner } from "@/components/ui";
import { WalletPicker } from "@/components/wallet";
import { base58, canPay, connectWallet, signAndSend, walletError, type StandardWallet } from "@/lib/client/wallets";

type Token = "USDC" | "SOL";
interface Quote {
  paymentId: string;
  token: Token;
  amount: string;
  decimals: number;
  mint?: string;
  receiver: string;
  reference: string;
  cluster: string;
  expiresAt: string;
  credits: number;
  usd: number;
  usdRate?: number;
}
const fmt = (amount: string, decimals: number, token: Token) => {
  const n = Number(amount) / 10 ** decimals;
  return `${token === "SOL" ? n.toFixed(4) : n.toFixed(2)} ${token}`;
};

/**
 * Pay for a credit pack with USDC or SOL from any Solana wallet. The wallet only signs
 * this one payment; credits arrive after our server confirms it on-chain.
 */
export function CryptoCheckout({ pack, token, onClose, onPaid }: { pack: { id: string; credits: number } | null; token: Token; onClose: () => void; onPaid: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [step, setStep] = useState<"idle" | "quoting" | "ready" | "signing" | "confirming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [walletName, setWalletName] = useState("your wallet");

  useEffect(() => {
    if (!pack) return;
    setQuote(null);
    setSig(null);
    setError(null);
    setStep("quoting");
    api<Quote>("/api/billing/solana/quote", { method: "POST", json: { itemId: pack.id, token } })
      .then((q) => {
        setQuote(q);
        setStep("ready");
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Couldn't create a quote.");
        setStep("idle");
      });
  }, [pack, token]);

  useEffect(() => {
    if (!quote) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((new Date(quote.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [quote]);

  const pay = async (w: StandardWallet) => {
    if (!quote) return;
    setWalletName(w.name);
    setError(null);
    setStep("signing");
    try {
      const account = await connectWallet(w);
      const [{ PublicKey }, { buildPaymentTransaction }] = await Promise.all([import("@solana/web3.js"), import("@/lib/solana-pay")]);
      const bh = await api<{ blockhash: string; lastValidBlockHeight: number }>("/api/billing/solana/blockhash");
      const txn = buildPaymentTransaction(quote, new PublicKey(account.address), bh.blockhash, bh.lastValidBlockHeight);
      const bytes = txn.serialize({ requireAllSignatures: false, verifySignatures: false });
      const signature = base58(await signAndSend(w, account, new Uint8Array(bytes), quote.cluster));
      setSig(signature);
      setStep("confirming");
      for (let i = 0; i < 40; i++) {
        const r = await api<{ status: string }>("/api/billing/solana/confirm", { method: "POST", json: { paymentId: quote.paymentId, signature } });
        if (r.status === "succeeded") {
          setStep("done");
          onPaid();
          return;
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
      setError("The payment was sent but hasn't confirmed yet. It will be credited as soon as it does — you can close this.");
    } catch (e) {
      const m = e instanceof ApiError ? e.message : walletError(e, "The payment didn't go through.");
      setError(m);
      setStep("ready");
    }
  };

  return (
    <Modal open={!!pack} onClose={onClose} label={`Buy credits with ${token}`}>
      <div className="w-[min(440px,92vw)] rounded-[16px] border border-line bg-[var(--card)] p-5">
        <h2 className="text-title font-semibold">
          {pack?.credits} credits with {token}
        </h2>
        <p className="mt-1 text-small text-fg-2">Paid from your Solana wallet straight to In My World. Credits are added once the payment confirms on Solana.</p>

        <div className="mt-5 rounded-[12px] border border-line-soft bg-bg p-4">
          {step === "quoting" && (
            <p className="flex items-center gap-2 text-small text-fg-2">
              <Spinner /> Getting a quote…
            </p>
          )}
          {quote && (
            <>
              <p className="text-caption text-fg-3">You pay</p>
              <p className="mt-0.5 text-heading font-semibold">{fmt(quote.amount, quote.decimals, quote.token)}</p>
              <p className="mt-1 text-caption text-fg-3">
                ${quote.usd.toFixed(2)}
                {quote.usdRate ? ` at $${quote.usdRate.toFixed(2)} per SOL` : ""} · quote valid for {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
                {quote.cluster !== "mainnet-beta" ? ` · ${quote.cluster}` : ""}
              </p>
            </>
          )}
        </div>

        {step === "done" && <Notice tone="accent" className="mt-4">Paid. {pack?.credits} credits are in your account.</Notice>}
        {error && <Notice tone="danger" className="mt-4">{error}</Notice>}
        {sig && (
          <p className="mt-3 truncate text-caption text-fg-3">
            Transaction:{" "}
            <a className="underline" target="_blank" rel="noreferrer" href={`https://solscan.io/tx/${sig}${quote?.cluster === "devnet" ? "?cluster=devnet" : ""}`}>
              {sig.slice(0, 18)}…
            </a>
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-start justify-end gap-2">
          <Button onClick={onClose}>{step === "done" ? "Close" : "Cancel"}</Button>
          {step !== "done" &&
            (step === "signing" || step === "confirming" ? (
              <Button variant="primary" disabled>
                <Spinner /> {step === "signing" ? `Approve in ${walletName}…` : "Confirming…"}
              </Button>
            ) : left === 0 && quote ? (
              <Button variant="primary" disabled>
                Quote expired
              </Button>
            ) : quote ? (
              <WalletPicker label="Pay with a wallet" onPick={pay} filter={canPay} className="min-w-[220px]" />
            ) : null)}
        </div>
        <p className="mt-4 text-micro text-fg-2">We never ask for your seed phrase or private key. Your wallet only approves this one payment.</p>
      </div>
    </Modal>
  );
}

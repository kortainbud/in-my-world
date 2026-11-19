"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Button, Modal, Notice, Spinner } from "@/components/ui";

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
type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string; toBase58(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction(tx: unknown): Promise<{ signature: string }>;
};

function phantom(): PhantomProvider | undefined {
  const w = window as unknown as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : undefined);
}

const fmt = (amount: string, decimals: number, token: Token) => {
  const n = Number(amount) / 10 ** decimals;
  return `${token === "SOL" ? n.toFixed(4) : n.toFixed(2)} ${token}`;
};

/**
 * Pay for a credit pack with USDC or SOL from Phantom. The wallet only signs
 * this one payment; credits arrive after our server confirms it on-chain.
 */
export function CryptoCheckout({ pack, token, onClose, onPaid }: { pack: { id: string; credits: number } | null; token: Token; onClose: () => void; onPaid: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [step, setStep] = useState<"idle" | "quoting" | "ready" | "signing" | "confirming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const hasPhantom = typeof window !== "undefined" && !!phantom();

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

  const pay = async () => {
    if (!quote) return;
    const w = phantom();
    if (!w) return;
    setError(null);
    setStep("signing");
    try {
      const { publicKey } = await w.connect();
      const [{ PublicKey }, { buildPaymentTransaction }] = await Promise.all([import("@solana/web3.js"), import("@/lib/solana-pay")]);
      const bh = await api<{ blockhash: string; lastValidBlockHeight: number }>("/api/billing/solana/blockhash");
      const txn = buildPaymentTransaction(quote, new PublicKey(publicKey.toString()), bh.blockhash, bh.lastValidBlockHeight);
      const { signature } = await w.signAndSendTransaction(txn);
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
      const m = e instanceof ApiError ? e.message : e instanceof Error && /reject|cancel|denied/i.test(e.message) ? "You cancelled the payment in Phantom." : e instanceof Error ? e.message : "The payment didn't go through.";
      setError(m);
      setStep("ready");
    }
  };

  return (
    <Modal open={!!pack} onClose={onClose} label={`Buy credits with ${token}`}>
      <div className="w-[min(440px,92vw)] rounded-[14px] border border-line bg-bg-2 p-5">
        <h2 className="text-title font-semibold">
          {pack?.credits} credits with {token}
        </h2>
        <p className="mt-1 text-small text-fg-2">Paid from your Phantom wallet straight to In My World. Credits are added once the payment confirms on Solana.</p>

        <div className="mt-5 rounded-[10px] border border-line-soft bg-bg p-4">
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

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>{step === "done" ? "Close" : "Cancel"}</Button>
          {step !== "done" &&
            (hasPhantom ? (
              <Button variant="primary" onClick={pay} disabled={!quote || left === 0 || step === "signing" || step === "confirming"}>
                {step === "signing" ? <><Spinner /> Approve in Phantom…</> : step === "confirming" ? <><Spinner /> Confirming…</> : left === 0 && quote ? "Quote expired" : "Pay with Phantom"}
              </Button>
            ) : (
              <a href="https://phantom.com/download" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-[var(--btn-radius)] bg-accent px-4 text-body font-medium text-accent-ink">
                Get Phantom
              </a>
            ))}
        </div>
        <p className="mt-4 text-micro text-fg-3">We never ask for your seed phrase or private key. Your wallet only approves this one payment.</p>
      </div>
    </Modal>
  );
}

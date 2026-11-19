"use client";
import { useEffect, useState } from "react";

/**
 * Solana wallets via the Wallet Standard — the protocol Phantom, Solflare,
 * Backpack, MetaMask (Solana) and most other Solana wallets use to announce
 * themselves to web apps. No wallet SDKs: wallets register with us, and we
 * only ever ask them to connect, sign a text message, or approve one payment.
 */

type Bytes = Uint8Array;
export interface WalletAccount {
  address: string;
  chains: readonly string[];
}
export interface StandardWallet {
  name: string;
  icon: string;
  chains: readonly string[];
  accounts: readonly WalletAccount[];
  features: Record<string, unknown>;
}
type ConnectFeature = { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }> };
type SignMessageFeature = { signMessage(...inputs: { account: WalletAccount; message: Bytes }[]): Promise<{ signedMessage: Bytes; signature: Bytes }[]> };
type SignAndSendFeature = {
  signAndSendTransaction(...inputs: { account: WalletAccount; chain: string; transaction: Bytes; options?: Record<string, unknown> }[]): Promise<{ signature: Bytes }[]>;
};

type RegisterApi = { register(...wallets: StandardWallet[]): () => void };
type G = { __imwWallets?: { list: Set<StandardWallet>; subs: Set<() => void> } };

function registry() {
  const g = window as unknown as G;
  if (g.__imwWallets) return g.__imwWallets;
  const state = { list: new Set<StandardWallet>(), subs: new Set<() => void>() };
  g.__imwWallets = state;
  const notify = () => state.subs.forEach((f) => f());
  const api: RegisterApi = Object.freeze({
    register(...ws: StandardWallet[]) {
      ws.forEach((w) => state.list.add(w));
      notify();
      return () => {
        ws.forEach((w) => state.list.delete(w));
        notify();
      };
    },
  });
  const safe = (cb: unknown) => {
    try {
      (cb as (a: RegisterApi) => void)(api);
    } catch {}
  };
  // Wallets that load after us announce themselves with this event…
  window.addEventListener("wallet-standard:register-wallet", (e) => safe((e as CustomEvent).detail));
  // …and wallets already on the page register when we say we're ready.
  window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  // Legacy navigator.wallets queue.
  try {
    const nav = window.navigator as unknown as { wallets?: unknown[] };
    const queued = Array.isArray(nav.wallets) ? nav.wallets : [];
    Object.defineProperty(window.navigator, "wallets", { value: Object.freeze({ push: (...cbs: unknown[]) => cbs.forEach(safe) }), configurable: true });
    queued.forEach(safe);
  } catch {}
  return state;
}

function isSolana(w: StandardWallet) {
  return w.chains.some((c) => c.startsWith("solana:")) && "standard:connect" in w.features && "solana:signMessage" in w.features;
}

/** Installed Solana wallets, updating as extensions announce themselves. */
export function useSolanaWallets() {
  const [wallets, setWallets] = useState<StandardWallet[] | null>(null);
  useEffect(() => {
    const r = registry();
    const read = () => {
      const seen = new Set<string>();
      setWallets([...r.list].filter(isSolana).filter((w) => (seen.has(w.name) ? false : (seen.add(w.name), true))));
    };
    r.subs.add(read);
    read();
    return () => void r.subs.delete(read);
  }, []);
  return wallets;
}

/** Wallets we suggest when none are installed. */
export const POPULAR_WALLETS = [
  { name: "Phantom", url: "https://phantom.com/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/download" },
];

export async function connectWallet(w: StandardWallet): Promise<WalletAccount> {
  const { accounts } = await (w.features["standard:connect"] as ConnectFeature).connect();
  const acct = accounts.find((a) => a.chains.some((c) => c.startsWith("solana:"))) ?? accounts[0];
  if (!acct) throw new Error("The wallet didn't share an account.");
  return acct;
}

export async function signText(w: StandardWallet, account: WalletAccount, text: string): Promise<Bytes> {
  const [out] = await (w.features["solana:signMessage"] as SignMessageFeature).signMessage({ account, message: new TextEncoder().encode(text) });
  return out.signature;
}

export function canPay(w: StandardWallet) {
  return "solana:signAndSendTransaction" in w.features;
}

export async function signAndSend(w: StandardWallet, account: WalletAccount, transaction: Bytes, cluster: string): Promise<Bytes> {
  const chain = cluster === "mainnet-beta" ? "solana:mainnet" : `solana:${cluster}`;
  const [out] = await (w.features["solana:signAndSendTransaction"] as SignAndSendFeature).signAndSendTransaction({ account, chain, transaction });
  return out.signature;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes: Bytes) {
  const Z = BigInt(0), B256 = BigInt(256), B58N = BigInt(58);
  let n = Z;
  for (const b of bytes) n = n * B256 + BigInt(b);
  let s = "";
  while (n > Z) {
    s = B58[Number(n % B58N)] + s;
    n /= B58N;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}

export function walletError(e: unknown, fallback: string) {
  if (e instanceof Error && /reject|denied|cancel|declined|closed/i.test(e.message)) return "You cancelled the request in your wallet.";
  return e instanceof Error && e.message ? e.message : fallback;
}

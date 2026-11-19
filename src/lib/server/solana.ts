import "server-only";
import { Connection, Keypair, PublicKey, clusterApiUrl, type ParsedInstruction, type PartiallyDecodedInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { HttpError } from "./auth";
import { findOne, getDoc, now } from "./data";
import type { Payment } from "./models";
import type { User } from "./models";
import { SOLANA_ENABLED, SOLANA_RECEIVER, fulfill, recordPending, type Item } from "./payments";

/**
 * Solana payments for credit packs, in USDC or SOL, sent straight to the
 * merchant wallet. Each payment gets a unique reference key that the buyer's
 * transaction must include, so a payment can be matched to exactly one
 * transaction. Credits are granted only after the transaction is confirmed
 * on-chain with the right recipient, token and amount.
 */

export const CLUSTER = (process.env.SOLANA_CLUSTER || "mainnet-beta") as "mainnet-beta" | "devnet";
const RPC = process.env.SOLANA_RPC_URL || clusterApiUrl(CLUSTER);
const USDC_MINT = process.env.SOLANA_USDC_MINT || (CLUSTER === "devnet" ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const QUOTE_MINUTES = 10;

let conn: Connection | null = null;
const connection = () => (conn ??= new Connection(RPC, "confirmed"));

function requireSolana() {
  if (!SOLANA_ENABLED) throw new HttpError(503, "Crypto payments aren't set up yet.", "payments_unavailable");
}

let priceCache: { usd: number; at: number } | null = null;
/** SOL/USD from public price APIs (CoinGecko, falling back to Jupiter). Cached for a minute. */
async function solUsd(): Promise<number> {
  if (priceCache && Date.now() - priceCache.at < 60_000) return priceCache.usd;
  const sources: (() => Promise<number>)[] = [
    async () => {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" });
      return Number((await r.json())?.solana?.usd);
    },
    async () => {
      const r = await fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112", { cache: "no-store" });
      const j = await r.json();
      return Number(j?.So11111111111111111111111111111111111111112?.usdPrice);
    },
  ];
  for (const s of sources) {
    try {
      const usd = await s();
      if (usd > 1 && usd < 100_000) {
        priceCache = { usd, at: Date.now() };
        return usd;
      }
    } catch {
      /* try the next source */
    }
  }
  throw new HttpError(503, "Couldn't get a SOL price right now. Try USDC, or try again in a minute.");
}

export async function createSolanaQuote(user: User, item: Item, token: "USDC" | "SOL") {
  requireSolana();
  if (item.kind !== "credits") throw new HttpError(400, "Crypto is available for credit packs. Plans are paid by card.");
  const usd = item.amountCents / 100;
  let amount: bigint, decimals: number, usdRate: number | undefined;
  if (token === "USDC") {
    decimals = 6;
    amount = BigInt(item.amountCents) * BigInt(10_000); // cents → 6-decimal units
  } else {
    decimals = 9;
    usdRate = await solUsd();
    amount = BigInt(Math.ceil((usd / usdRate) * 1e9));
  }
  const reference = Keypair.generate().publicKey.toBase58();
  const p = await recordPending({
    userId: user.id, provider: "solana", kind: "credits", itemId: item.id, amountCents: item.amountCents, currency: "usd", credits: item.credits,
    crypto: {
      token, amount: amount.toString(), decimals, mint: token === "USDC" ? USDC_MINT : undefined, receiver: SOLANA_RECEIVER, reference, cluster: CLUSTER,
      expiresAt: new Date(Date.now() + QUOTE_MINUTES * 60_000).toISOString(), usdRate,
    },
  });
  return { paymentId: p.id, ...p.crypto!, credits: p.credits, usd };
}

export async function latestBlockhash() {
  requireSolana();
  return connection().getLatestBlockhash("confirmed");
}

type Ix = ParsedInstruction | PartiallyDecodedInstruction;

/** Verifies the transaction on-chain and fulfils the payment once. */
export async function confirmSolanaPayment(user: User, paymentId: string, signature?: string) {
  requireSolana();
  const found0 = await getDoc<Payment>("payments", paymentId);
  const p = found0 && found0.userId === user.id && found0.provider === "solana" ? found0 : null;
  if (!p?.crypto) throw new HttpError(404, "Payment not found.");
  if (p.status === "succeeded") return { status: "succeeded" as const, signature: p.providerRef };
  const c = p.crypto;

  // Without a signature (e.g. the tab closed), look the transaction up by its reference.
  let sig = signature;
  if (!sig) {
    const found = await connection().getSignaturesForAddress(new PublicKey(c.reference), { limit: 5 }, "confirmed");
    sig = found.find((x) => !x.err)?.signature;
    if (!sig) return { status: "pending" as const };
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) throw new HttpError(400, "That doesn't look like a transaction signature.");
  const used = await findOne<Payment>("payments", (q) => q.eq("provider_ref", sig!).neq("id", p.id));
  if (used) throw new HttpError(409, "That transaction has already been used for another payment.");

  const txn = await connection().getParsedTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!txn) return { status: "pending" as const };
  if (txn.meta?.err) throw new HttpError(400, "That transaction failed on-chain.");
  const blockTime = (txn.blockTime ?? 0) * 1000;
  if (blockTime && blockTime > new Date(c.expiresAt).getTime() + 5 * 60_000) throw new HttpError(400, "This quote expired before the payment was made. Start a new payment.");

  const keys = txn.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  if (!keys.includes(c.reference)) throw new HttpError(400, "That transaction isn't for this payment.");

  const all: Ix[] = [...txn.transaction.message.instructions, ...(txn.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
  const want = BigInt(c.amount);
  let paid = BigInt(0);
  if (c.token === "SOL") {
    for (const ix of all) {
      if (!("parsed" in ix) || ix.program !== "system" || ix.parsed?.type !== "transfer") continue;
      if (ix.parsed.info.destination === c.receiver) paid += BigInt(ix.parsed.info.lamports);
    }
  } else {
    const ata = getAssociatedTokenAddressSync(new PublicKey(c.mint!), new PublicKey(c.receiver), true).toBase58();
    for (const ix of all) {
      if (!("parsed" in ix) || ix.program !== "spl-token") continue;
      const t = ix.parsed?.type, info = ix.parsed?.info;
      if (t === "transferChecked" && info.destination === ata && info.mint === c.mint) paid += BigInt(info.tokenAmount.amount);
      if (t === "transfer" && info.destination === ata) paid += BigInt(info.amount);
    }
  }
  if (paid < want) throw new HttpError(400, `The transaction paid less than the quote (${paid} of ${want}).`);

  await fulfill(p.id, { providerRef: sig });
  return { status: "succeeded" as const, signature: sig, at: now() };
}

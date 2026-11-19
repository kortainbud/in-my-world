/**
 * Builds the buyer's payment transaction (shared by the browser and tests).
 * The unique reference key is attached to the transfer instruction as a
 * read-only, non-signer account so the server can match the payment.
 */
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";

export interface Quote {
  token: "USDC" | "SOL";
  amount: string;
  decimals: number;
  mint?: string;
  receiver: string;
  reference: string;
}

export function buildPaymentTransaction(q: Quote, payer: PublicKey, blockhash: string, lastValidBlockHeight: number) {
  const receiver = new PublicKey(q.receiver);
  const reference = new PublicKey(q.reference);
  const tx = new Transaction({ feePayer: payer, blockhash, lastValidBlockHeight });
  if (q.token === "SOL") {
    const ix = SystemProgram.transfer({ fromPubkey: payer, toPubkey: receiver, lamports: BigInt(q.amount) });
    ix.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
    tx.add(ix);
  } else {
    const mint = new PublicKey(q.mint!);
    const from = getAssociatedTokenAddressSync(mint, payer);
    const to = getAssociatedTokenAddressSync(mint, receiver, true);
    // No-op if the merchant's USDC account already exists.
    tx.add(createAssociatedTokenAccountIdempotentInstruction(payer, to, receiver, mint));
    const ix = createTransferCheckedInstruction(from, mint, to, payer, BigInt(q.amount), q.decimals);
    ix.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
    tx.add(ix);
  }
  return tx;
}

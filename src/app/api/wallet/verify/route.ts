import { createAccount, createSession, currentUser, HttpError } from "@/lib/server/auth";
import { findOne, insertDoc, isUniqueViolation, newId, now, takeDoc } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import type { Wallet, WalletNonce } from "@/lib/server/models";
import { verifyWalletSignature } from "@/lib/server/wallets";

/**
 * Verifies a signed nonce. purpose=link attaches the wallet to the signed-in
 * account; purpose=signin signs in the account that owns the wallet (creating
 * one if this wallet is new). Wallets are identity only — not payment.
 */
export const POST = route(async (req: Request) => {
  const b = await body(req);
  const nonce = String(b.nonce ?? "");
  const signature = String(b.signature ?? "");
  const user = await currentUser();
  const n = nonce ? await takeDoc<WalletNonce>("wallet_nonces", nonce) : null; // single use
  if (!n || new Date(n.expiresAt) < new Date()) throw new HttpError(400, "That signature request expired. Try again.");
  const ok = await verifyWalletSignature(n.chain, n.address, n.message, signature);
  if (!ok) throw new HttpError(401, "The signature didn't match this wallet.");
  const addr = n.chain === "evm" ? n.address.toLowerCase() : n.address;
  const find = () => findOne<Wallet>("wallets", (q) => q.eq("chain", n.chain).eq("address", addr));
  const link = async (userId: string) => {
    const w: Wallet = { id: newId("wal"), userId, chain: n.chain, address: addr, purpose: "identity", linkedAt: now() };
    await insertDoc("wallets", w.id, w);
  };

  if (n.purpose === "link") {
    if (!user || user.id !== n.userId) throw new HttpError(401, "Sign in to link a wallet.");
    const existing = await find();
    if (existing && existing.userId !== user.id) throw new HttpError(409, "This wallet is linked to another account.");
    if (!existing) {
      try {
        await link(user.id);
      } catch (e) {
        if (isUniqueViolation(e)) throw new HttpError(409, "This wallet is linked to another account.");
        throw e;
      }
    }
    return json({ ok: true, linked: true });
  }

  let w = await find();
  if (!w) {
    const u = await createAccount({ email: null, passwordHash: null, displayName: `${addr.slice(0, 4)}…${addr.slice(-4)}` });
    try {
      await link(u.id);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
    w = await find();
  }
  if (!w) throw new HttpError(500, "Couldn't sign in with this wallet. Try again.");
  await createSession(w.userId);
  return json({ ok: true, signedIn: true });
});

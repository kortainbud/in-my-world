import { createAccount, createSession, currentUser, HttpError } from "@/lib/server/auth";
import { id, now, tx } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
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
  const n = await tx((db) => {
    const found = db.walletNonces.find((x) => x.nonce === nonce);
    db.walletNonces = db.walletNonces.filter((x) => x.nonce !== nonce); // single use
    return found;
  });
  if (!n || new Date(n.expiresAt) < new Date()) throw new HttpError(400, "That signature request expired. Try again.");
  const ok = await verifyWalletSignature(n.chain, n.address, n.message, signature);
  if (!ok) throw new HttpError(401, "The signature didn't match this wallet.");
  const addr = n.chain === "evm" ? n.address.toLowerCase() : n.address;

  if (n.purpose === "link") {
    if (!user || user.id !== n.userId) throw new HttpError(401, "Sign in to link a wallet.");
    await tx((db) => {
      const existing = db.wallets.find((w) => w.chain === n.chain && w.address === addr);
      if (existing && existing.userId !== user.id) throw new HttpError(409, "This wallet is linked to another account.");
      if (!existing) db.wallets.push({ id: id("wal"), userId: user.id, chain: n.chain, address: addr, purpose: "identity", linkedAt: now() });
    });
    return json({ ok: true, linked: true });
  }

  const userId = await tx((db) => {
    const w = db.wallets.find((x) => x.chain === n.chain && x.address === addr);
    if (w) return w.userId;
    const u = createAccount(db, { email: null, passwordHash: null, displayName: `${addr.slice(0, 4)}…${addr.slice(-4)}` });
    db.wallets.push({ id: id("wal"), userId: u.id, chain: n.chain, address: addr, purpose: "identity", linkedAt: now() });
    return u.id;
  });
  await createSession(userId);
  return json({ ok: true, signedIn: true });
});

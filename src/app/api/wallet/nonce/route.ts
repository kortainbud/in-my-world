import crypto from "node:crypto";
import { currentUser, HttpError } from "@/lib/server/auth";
import { tx } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { validAddress, walletMessage } from "@/lib/server/wallets";

export const POST = route(async (req: Request) => {
  const b = await body(req);
  const chain = b.chain === "evm" ? "evm" : b.chain === "solana" ? "solana" : null;
  const address = String(b.address ?? "");
  const purpose = b.purpose === "link" ? "link" : "signin";
  if (!chain || !validAddress(chain, address)) throw new HttpError(400, "That wallet address doesn't look right.");
  const user = await currentUser();
  if (purpose === "link" && !user) throw new HttpError(401, "Sign in to link a wallet.");
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = walletMessage({ address, purpose, nonce, origin: new URL(req.url).host });
  await tx((db) => {
    db.walletNonces = db.walletNonces.filter((n) => new Date(n.expiresAt) > new Date());
    db.walletNonces.push({ nonce, chain, address, purpose, userId: user?.id, message, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
  });
  return json({ nonce, message });
});

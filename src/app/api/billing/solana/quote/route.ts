import { HttpError, requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { findItem } from "@/lib/server/payments";
import { createSolanaQuote } from "@/lib/server/solana";

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  const item = findItem("credits", String(b.itemId));
  if (!item) throw new HttpError(400, "Unknown credit pack.");
  const token = b.token === "SOL" ? "SOL" : "USDC";
  return json(await createSolanaQuote(user, item, token));
});

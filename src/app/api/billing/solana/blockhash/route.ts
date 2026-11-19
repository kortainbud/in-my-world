import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { latestBlockhash } from "@/lib/server/solana";

/** Recent blockhash via our RPC, so the browser never needs the RPC key. */
export const GET = route(async () => {
  await requireUser();
  return json(await latestBlockhash());
});

import { requireUser } from "@/lib/server/auth";
import { addCredits } from "@/lib/server/credits";
import { requireDevMode } from "@/lib/server/dev";
import { body, json, route } from "@/lib/server/http";

/** Development only: grants test credits, recorded in the ledger as a dev grant. */
export const POST = route(async (req: Request) => {
  requireDevMode();
  const user = await requireUser();
  const b = await body(req);
  const amount = Math.min(1000, Math.max(1, Math.floor(Number(b.amount) || 100)));
  await addCredits(user.id, amount, "dev_grant", "Development test credits (not purchasable)");
  return json({ ok: true });
});

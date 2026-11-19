import { requireUser } from "@/lib/server/auth";
import { id, now, tx } from "@/lib/server/db";
import { requireDevMode } from "@/lib/server/dev";
import { body, json, route } from "@/lib/server/http";

/** Development only: grants test credits, recorded in the ledger as a dev grant. */
export const POST = route(async (req: Request) => {
  requireDevMode();
  const user = await requireUser();
  const b = await body(req);
  const amount = Math.min(1000, Math.max(1, Math.floor(Number(b.amount) || 100)));
  await tx((db) => {
    db.credits.push({ id: id("ctx"), userId: user.id, amount, kind: "dev_grant", note: "Development test credits (not purchasable)", createdAt: now() });
  });
  return json({ ok: true });
});

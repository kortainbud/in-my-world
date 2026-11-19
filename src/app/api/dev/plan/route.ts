import { HttpError, requireUser } from "@/lib/server/auth";
import { PLANS } from "@/config/plans";
import { mutateDoc } from "@/lib/server/data";
import { requireDevMode } from "@/lib/server/dev";
import { body, json, route } from "@/lib/server/http";
import type { Subscription } from "@/lib/server/models";

/** Development only: switches plan without payment so plan limits can be tested. */
export const POST = route(async (req: Request) => {
  requireDevMode();
  const user = await requireUser();
  const b = await body(req);
  const plan = PLANS.find((p) => p.id === b.planId);
  if (!plan) throw new HttpError(400, "Unknown plan.");
  await mutateDoc<Subscription>("subscriptions", user.id, (s) => {
    s.planId = plan.id;
    s.provider = "dev";
  });
  return json({ ok: true });
});

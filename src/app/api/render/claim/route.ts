import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { claimRender } from "@/lib/server/pipeline";
import { HttpError } from "@/lib/server/auth";

/** A browser render agent asks for the next video it may render. */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  const agentId = typeof b.agentId === "string" && /^[a-z0-9-]{8,64}$/i.test(b.agentId) ? b.agentId : null;
  if (!agentId) throw new HttpError(400, "Missing render agent id.");
  const job = await claimRender(user, agentId);
  return json({ job });
});

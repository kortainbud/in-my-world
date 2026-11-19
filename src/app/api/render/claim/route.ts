import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { findOne } from "@/lib/server/data";
import type { GenerationJob } from "@/lib/server/models";
import { advanceJob, claimRender } from "@/lib/server/pipeline";
import { HttpError } from "@/lib/server/auth";

/** A browser render agent asks for the next video it may render. */
export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  const agentId = typeof b.agentId === "string" && /^[a-z0-9-]{8,64}$/i.test(b.agentId) ? b.agentId : null;
  if (!agentId) throw new HttpError(400, "Missing render agent id.");
  // Any open studio tab also moves the user's queued videos forward.
  const waiting = await findOne<GenerationJob>("jobs", (q) => q.eq("user_id", user.id).in("status", ["queued", "processing"]).order("ts", { ascending: true }));
  if (waiting) await advanceJob(waiting.id, user.id).catch(() => undefined);
  const job = await claimRender(user, agentId);
  return json({ job });
});

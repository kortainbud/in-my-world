import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { narrationUploadUrls, saveNarration } from "@/lib/server/pipeline";

type Ctx = { params: Promise<{ jobId: string }> };

/** Step 1: the render agent asks where to upload the narration it will record. */
export const PUT = route(async (req: Request, ctx: Ctx) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  return json({ uploads: await narrationUploadUrls(user, jobId, String(b.agentId ?? "")) });
});

/** Step 2: clips are uploaded (or recording failed); recompile the timeline to the real speech. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  const skipped = typeof b.skipped === "string" && b.skipped ? b.skipped : null;
  return json(await saveNarration(user, jobId, String(b.agentId ?? ""), skipped));
});

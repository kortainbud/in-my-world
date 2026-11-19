import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { reportProgress } from "@/lib/server/pipeline";

export const POST = route(async (req: Request, ctx: { params: Promise<{ jobId: string }> }) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  await reportProgress(user, jobId, String(b.agentId), { phase: String(b.phase), framesDone: Number(b.framesDone) || 0, framesTotal: Number(b.framesTotal) || 1 });
  return json({ ok: true });
});

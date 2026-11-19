import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { reportRenderFailure } from "@/lib/server/pipeline";

export const POST = route(async (req: Request, ctx: { params: Promise<{ jobId: string }> }) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  await reportRenderFailure(user, jobId, String(b.agentId), String(b.message ?? "Unknown error"), b.retryable !== false);
  return json({ ok: true });
});

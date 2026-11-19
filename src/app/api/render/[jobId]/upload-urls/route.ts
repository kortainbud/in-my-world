import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { renderUploadUrls } from "@/lib/server/pipeline";

export const POST = route(async (req: Request, ctx: { params: Promise<{ jobId: string }> }) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  return json(await renderUploadUrls(user, jobId, String(b.agentId ?? "")));
});

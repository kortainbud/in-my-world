import { HttpError, requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { savePreview } from "@/lib/server/pipeline";

export const POST = route(async (req: Request, ctx: { params: Promise<{ jobId: string }> }) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const u = new URL(req.url);
  const scene = Number(u.searchParams.get("scene"));
  const agentId = req.headers.get("x-render-agent") ?? "";
  if (!Number.isInteger(scene) || scene < 0 || scene > 40) throw new HttpError(400, "Invalid scene.");
  await savePreview(user, jobId, agentId, scene, Buffer.from(await req.arrayBuffer()));
  return json({ ok: true });
});

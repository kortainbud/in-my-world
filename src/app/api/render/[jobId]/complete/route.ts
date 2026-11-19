import { HttpError, requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { completeRender } from "@/lib/server/pipeline";

const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

export const POST = route(async (req: Request, ctx: { params: Promise<{ jobId: string }> }) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_VIDEO_BYTES) throw new HttpError(413, "Video is too large.");
  const form = await req.formData();
  const mp4 = form.get("video");
  const thumb = form.get("thumbnail");
  const meta = JSON.parse(String(form.get("meta") ?? "{}"));
  const agentId = String(form.get("agentId") ?? "");
  if (!(mp4 instanceof Blob) || !(thumb instanceof Blob)) throw new HttpError(400, "Missing video or thumbnail.");
  const res = await completeRender(
    user, jobId, agentId,
    { mp4: Buffer.from(await mp4.arrayBuffer()), thumb: Buffer.from(await thumb.arrayBuffer()) },
    { width: Number(meta.width), height: Number(meta.height), durationSec: Number(meta.durationSec), videoCodec: String(meta.videoCodec ?? ""), audioCodec: String(meta.audioCodec ?? "") },
  );
  return json(res);
});

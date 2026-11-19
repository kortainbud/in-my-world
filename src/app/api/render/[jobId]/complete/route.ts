import { HttpError, requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { completeRender } from "@/lib/server/pipeline";

/** The agent has uploaded the MP4 + thumbnail to storage; verify and finish the job. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ jobId: string }> }) => {
  const { jobId } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  const videoId = String(b.videoId ?? "");
  if (!/^vid_[A-Za-z0-9]+$/.test(videoId)) throw new HttpError(400, "Missing upload.");
  return json(
    await completeRender(user, jobId, String(b.agentId ?? ""), {
      videoId, width: Number(b.width), height: Number(b.height), durationSec: Number(b.durationSec), videoCodec: String(b.videoCodec ?? ""), audioCodec: String(b.audioCodec ?? ""),
    }),
  );
});

import { currentUser } from "@/lib/server/auth";
import { MODE } from "@/lib/server/config";
import { findOne, getDoc } from "@/lib/server/data";
import { signedReadUrl } from "@/lib/server/media";
import type { GenerationJob, Project, Video } from "@/lib/server/models";
import { SAMPLE_USER_ID } from "@/lib/server/pipeline";

/**
 * Media access control. Files live in private Supabase Storage buckets; after
 * the check this redirects to a short-lived signed URL (which supports Range
 * requests, so video seeking works).
 *  - owners can always read their media
 *  - anyone can read the video + thumbnail of a public, completed project
 *  - in development, sample projects are readable (the local render agent renders them)
 */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; file: string }> }) {
  const { kind, file } = await ctx.params;
  const key = `${kind}/${file}`;
  if (!/^(videos|thumbs|previews|audio)\/[A-Za-z0-9_.-]+$/.test(key)) return new Response("Not found", { status: 404 });
  const user = await currentUser();

  let video: Video | null = null;
  let projectId: string | undefined;
  if (kind === "videos" || kind === "thumbs") {
    video = await findOne<Video>("videos", (q) => q.or(`media_key.eq.${key},thumb_key.eq.${key}`));
    projectId = video?.projectId;
  } else {
    const jobId = /^(job_[A-Za-z0-9]+)_/.exec(file)?.[1];
    const job = jobId ? await getDoc<GenerationJob>("jobs", jobId) : null;
    const owns = job && (job.previews.some((p) => p.mediaKey === key) || job.audio?.some((a) => a.narration?.mediaKey === key || a.dialogue?.mediaKey === key));
    projectId = owns ? job.projectId : undefined;
  }
  const project = projectId ? await getDoc<Project>("projects", projectId) : null;
  const allowed =
    !!project &&
    ((user && project.userId === user.id) ||
      (MODE === "development" && project.userId === SAMPLE_USER_ID) ||
      (!!video && project.visibility === "public" && project.status === "completed"));
  if (!allowed) return new Response("Not found", { status: 404 });

  const dl = new URL(req.url).searchParams.get("download");
  const url = await signedReadUrl(key, 3600, dl ? `${dl.replace(/[^\w.-]+/g, "-").slice(0, 80) || "video"}.mp4` : undefined);
  if (!url) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=600" } });
}

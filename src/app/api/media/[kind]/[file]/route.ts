import fsp from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/server/auth";
import { MODE } from "@/lib/server/config";
import { read } from "@/lib/server/db";
import { CONTENT_TYPES, mediaPath } from "@/lib/server/media";
import { SAMPLE_USER_ID } from "@/lib/server/pipeline";

/**
 * Serves stored media with access control:
 *  - owners can always read their media
 *  - anyone can read the video + thumbnail of a public, completed project
 *  - in development, sample projects are readable (the local render agent renders them)
 * Supports HTTP Range requests so video seeking works.
 */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string; file: string }> }) {
  const { kind, file } = await ctx.params;
  const key = `${kind}/${file}`;
  const user = await currentUser();

  const allowed = await read((db) => {
    const video = db.videos.find((v) => v.mediaKey === key || v.thumbKey === key);
    const job = video ? undefined : db.jobs.find((j) => j.previews.some((p) => p.mediaKey === key) || j.audio?.some((a) => a.narration?.mediaKey === key || a.dialogue?.mediaKey === key));
    const project = db.projects.find((p) => p.id === (video?.projectId ?? job?.projectId));
    if (!project) return false;
    if (user && project.userId === user.id) return true;
    if (MODE === "development" && project.userId === SAMPLE_USER_ID) return true;
    return !!video && project.visibility === "public" && project.status === "completed";
  });
  if (!allowed) return new Response("Not found", { status: 404 });

  let p: string;
  try {
    p = await mediaPath(key);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const stat = await fsp.stat(p);
  const type = CONTENT_TYPES[path.extname(p)] ?? "application/octet-stream";
  const headers: Record<string, string> = { "content-type": type, "accept-ranges": "bytes", "cache-control": "private, max-age=3600" };
  const dl = new URL(req.url).searchParams.get("download");
  if (dl) headers["content-disposition"] = `attachment; filename="${dl.replace(/[^\w.-]+/g, "-").slice(0, 80) || "video"}.mp4"`;

  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${stat.size}` } });
    return new Response(fileStream(p, start, end), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${stat.size}`, "content-length": String(end - start + 1) } });
  }
  return new Response(fileStream(p, 0, stat.size - 1), { headers: { ...headers, "content-length": String(stat.size) } });
}

/** Pull-based file stream that closes cleanly when the client cancels (e.g. video seeking). */
function fileStream(file: string, start: number, end: number): ReadableStream<Uint8Array> {
  let fh: fsp.FileHandle | null = null;
  let pos = start;
  return new ReadableStream({
    async start() {
      fh = await fsp.open(file, "r");
    },
    async pull(ctrl) {
      if (!fh) return;
      const n = Math.min(256 * 1024, end - pos + 1);
      if (n <= 0) {
        await fh.close();
        fh = null;
        ctrl.close();
        return;
      }
      const buf = new Uint8Array(n);
      const { bytesRead } = await fh.read(buf, 0, n, pos);
      pos += bytesRead;
      if (bytesRead === 0) {
        await fh.close();
        fh = null;
        ctrl.close();
        return;
      }
      ctrl.enqueue(buf.subarray(0, bytesRead));
    },
    async cancel() {
      await fh?.close();
      fh = null;
    },
  });
}

import fs from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/server/auth";
import { read } from "@/lib/server/db";
import { copyToPublic, requireDevMode } from "@/lib/server/dev";
import { json, route } from "@/lib/server/http";
import { mediaPath } from "@/lib/server/media";
import { SAMPLE_USER_ID } from "@/lib/server/pipeline";

/**
 * Development only: copies the latest completed sample videos into
 * public/samples and writes src/data/samples.json, so the marketing site and
 * Explore can show real engine output without a database.
 */
export const POST = route(async () => {
  requireDevMode();
  await requireUser();
  const rows = await read((db) => {
    const done = db.projects.filter((p) => p.userId === SAMPLE_USER_ID && p.status === "completed" && p.videoId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const seen = new Set<string>();
    return done
      .filter((p) => (seen.has(p.prompt + p.style) ? false : (seen.add(p.prompt + p.style), true)))
      .map((p) => ({ p, v: db.videos.find((v) => v.id === p.videoId)! }));
  });
  const out = [];
  for (const { p, v } of rows) {
    const slug = `sample-${p.style}-${p.prompt.toLowerCase().replace(/^in my world,?\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;
    await copyToPublic(await mediaPath(v.mediaKey), `samples/${slug}.mp4`);
    await copyToPublic(await mediaPath(v.thumbKey), `samples/${slug}.jpg`);
    out.push({ id: slug, title: p.title, prompt: p.prompt, style: p.style, category: p.category, durationSec: Math.round(v.durationSec * 10) / 10, video: `/samples/${slug}.mp4`, thumb: `/samples/${slug}.jpg`, createdAt: p.createdAt });
  }
  await fs.writeFile(path.join(process.cwd(), "src/data/samples.json"), JSON.stringify(out, null, 2) + "\n");
  return json({ exported: out.length });
});

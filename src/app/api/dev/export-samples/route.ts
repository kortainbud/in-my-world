import fs from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/server/auth";
import { findDocs, findOne, getDoc } from "@/lib/server/data";
import type { GenerationJob, Project, Story, Video } from "@/lib/server/models";
import { copyToPublic, requireDevMode, SAMPLE_PROMPTS } from "@/lib/server/dev";
import { json, route } from "@/lib/server/http";
import { readMedia } from "@/lib/server/media";
import { SAMPLE_USER_ID } from "@/lib/server/pipeline";

/**
 * Development only: copies the latest completed sample videos into
 * public/samples and writes src/data/samples.json, so the marketing site and
 * Explore can show real engine output without a database.
 */
export const POST = route(async () => {
  requireDevMode();
  await requireUser();
  const wanted = new Set(SAMPLE_PROMPTS.map((x) => x.prompt + x.style));
  const done = (await findDocs<Project>("projects", (q) => q.eq("user_id", SAMPLE_USER_ID).eq("status", "completed").order("ts", { ascending: false })))
    .filter((p) => p.videoId && wanted.has(p.prompt + p.style));
  const seen = new Set<string>();
  const rows = await Promise.all(
    done
      .filter((p) => (seen.has(p.prompt + p.style) ? false : (seen.add(p.prompt + p.style), true)))
      .map(async (p) => ({
        p,
        v: (await getDoc<Video>("videos", p.videoId!))!,
        story: await findOne<Story>("stories", (q) => q.eq("project_id", p.id)),
        job: await getDoc<GenerationJob>("jobs", p.jobId),
      })),
  );
  // Start clean so stale sample files don't linger.
  await fs.rm(path.join(process.cwd(), "public/samples"), { recursive: true, force: true });
  const out = [];
  for (const { p, v, story, job } of rows) {
    const slug = `sample-${p.style}-${p.prompt.toLowerCase().replace(/^in my (world|town|city),?\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;
    await copyToPublic(await readMedia(v.mediaKey), `samples/${slug}.mp4`);
    await copyToPublic(await readMedia(v.thumbKey), `samples/${slug}.jpg`);
    const previews: string[] = [];
    for (const pv of job?.previews ?? []) {
      await copyToPublic(await readMedia(pv.mediaKey), `samples/${slug}-scene-${pv.scene}.jpg`);
      previews.push(`/samples/${slug}-scene-${pv.scene}.jpg`);
    }
    out.push({
      id: slug, title: p.title, prompt: p.prompt, style: p.style, category: p.category, durationSec: Math.round(v.durationSec * 10) / 10, width: v.width, height: v.height,
      video: `/samples/${slug}.mp4`, thumb: `/samples/${slug}.jpg`, createdAt: p.createdAt,
      format: p.format,
      story: {
        source: story?.source,
        sheet: story?.plan.sheet,
        scenes: (story?.plan.scenes ?? []).map((s) => ({ narration: s.narration, description: s.description, environment: s.environment })),
        cast: (story?.cast ?? []).map((c) => ({ id: c.id, name: c.name, appearance: c.appearance })),
      },
      previews,
    });
  }
  await fs.writeFile(path.join(process.cwd(), "src/data/samples.json"), JSON.stringify(out, null, 2) + "\n");
  return json({ exported: out.length });
});

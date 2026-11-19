import { getDoc, mutateDoc, upsertDoc } from "@/lib/server/data";
import { json, route } from "@/lib/server/http";
import type { Project } from "@/lib/server/models";
import { SAMPLES } from "@/lib/server/views";

type G = { __imwViewSeen?: Map<string, number> };
const g = globalThis as G;
g.__imwViewSeen ??= new Map();

/** Counts a play. De-duplicated per client per video per hour (per server instance). */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${who}|${id}`;
  const last = g.__imwViewSeen!.get(key) ?? 0;
  if (Date.now() - last < 36e5) return json({ counted: false });
  g.__imwViewSeen!.set(key, Date.now());
  if (SAMPLES.some((s) => s.id === id)) {
    const k = `views:${id}`;
    const done = await mutateDoc<{ id: string; n: number }>("sample_views", k, (d) => void (d.n += 1));
    if (!done) await upsertDoc("sample_views", k, { id: k, n: 1 });
    return json({ counted: true });
  }
  const p = await getDoc<Project>("projects", id);
  if (!p || p.visibility !== "public" || p.status !== "completed") return json({ counted: false });
  await mutateDoc<Project>("projects", id, (x) => void (x.views += 1));
  return json({ counted: true });
});

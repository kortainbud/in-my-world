import { tx } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { SAMPLES } from "@/lib/server/views";

type G = { __imwViewSeen?: Map<string, number> };
const g = globalThis as G;
g.__imwViewSeen ??= new Map();

/** Counts a play. De-duplicated per client per video per hour. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${who}|${id}`;
  const last = g.__imwViewSeen!.get(key) ?? 0;
  if (Date.now() - last < 36e5) return json({ counted: false });
  g.__imwViewSeen!.set(key, Date.now());
  const counted = await tx((db) => {
    if (SAMPLES.some((s) => s.id === id)) {
      db.sampleViews[id] = (db.sampleViews[id] ?? 0) + 1;
      return true;
    }
    const p = db.projects.find((x) => x.id === id && x.visibility === "public" && x.status === "completed");
    if (!p) return false;
    p.views++;
    return true;
  });
  return json({ counted });
});

import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { quote } from "@/lib/server/pipeline";
import { DURATIONS, VISUAL_STYLES, type DurationPreset, type VisualStyle } from "@/lib/engine/types";

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const u = new URL(req.url);
  const duration = Number(u.searchParams.get("duration")) as DurationPreset;
  const style = u.searchParams.get("style") as VisualStyle;
  const d = DURATIONS.includes(duration) ? duration : 30;
  const s = VISUAL_STYLES.includes(style) ? style : "roblox";
  const q = await quote(user.id, { duration: d, style: s });
  return json({ cost: q.cost, balance: q.balance, allowed: d <= q.plan.maxDurationSec, maxDurationSec: q.plan.maxDurationSec, planName: q.plan.name });
});

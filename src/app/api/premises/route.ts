import { requireUser } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";
import { generatePremises } from "@/lib/server/providers/story";

/** Concept development: suggest strange-rule premises to choose from. */
export const POST = route(async (req: Request) => {
  await requireUser();
  const b = await body(req);
  const seed = typeof b.seed === "string" ? b.seed.trim().slice(0, 120) : undefined;
  const avoid = Array.isArray(b.avoid) ? b.avoid.filter((x): x is string => typeof x === "string").slice(0, 30) : [];
  const res = await generatePremises({ seed: seed || undefined, count: 6, avoid });
  return json(res);
});

import { HttpError, requireUser } from "@/lib/server/auth";
import { getDoc } from "@/lib/server/data";
import type { Project } from "@/lib/server/models";
import { body, json, route } from "@/lib/server/http";
import { createGeneration, validateInput } from "@/lib/server/pipeline";

/** Continues a story as its next episode: same world, rule and cast. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  const p0 = await getDoc<Project>("projects", id);
  const p = p0 && p0.userId === user.id ? p0 : null;
  if (!p) throw new HttpError(404, "Project not found.");
  if (p.status !== "completed") throw new HttpError(409, "Finish this episode before starting the next one.");
  const input = validateInput({
    prompt: p.prompt, style: p.style, duration: p.durationPreset, castIds: p.castIds, voice: p.voice,
    format: p.format === "impossible_choice" ? "impossible_choice" : "mystery_series", previousProjectId: p.id, idempotencyKey: b.idempotencyKey,
  });
  const { project, duplicate } = await createGeneration(user, input);
  return json({ projectId: project.id, duplicate }, duplicate ? 200 : 201);
});

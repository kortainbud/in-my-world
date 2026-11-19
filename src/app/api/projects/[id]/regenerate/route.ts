import { HttpError, requireUser } from "@/lib/server/auth";
import { read } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { createGeneration, validateInput } from "@/lib/server/pipeline";

/** Generates a new version of a project with the same idea and settings. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  const p = await read((db) => db.projects.find((x) => x.id === id && x.userId === user.id));
  if (!p) throw new HttpError(404, "Project not found.");
  const input = validateInput({ prompt: p.prompt, style: p.style, duration: p.durationPreset, castIds: p.castIds, voice: p.voice, idempotencyKey: b.idempotencyKey, parentProjectId: p.id });
  const { project, duplicate } = await createGeneration(user, input);
  return json({ projectId: project.id, duplicate }, duplicate ? 200 : 201);
});

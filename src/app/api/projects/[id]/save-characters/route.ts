import { HttpError, requireUser } from "@/lib/server/auth";
import type { CharacterRecord } from "@/lib/engine/characters";
import { planFor } from "@/lib/server/credits";
import { countDocs, findOne, getDoc, insertDoc, mutateDoc, newId, now } from "@/lib/server/data";
import { json, route } from "@/lib/server/http";
import type { Project, Story } from "@/lib/server/models";

/** Saves characters that were designed for this story into the user's library. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const p = await getDoc<Project>("projects", id);
  if (!p || p.userId !== user.id) throw new HttpError(404, "Project not found.");
  const story0 = await findOne<Story>("stories", (q) => q.eq("project_id", p.id));
  if (!story0) throw new HttpError(409, "This story only used characters that are already in a library.");
  const plan = await planFor(user.id);
  const mine = await countDocs("characters", (q) => q.eq("owner_id", user.id));
  // Claim the generated characters first so the save can't be repeated.
  let gen: NonNullable<Story["cast"]> = [];
  await mutateDoc<Story>("stories", story0.id, (s) => {
    gen = (s.cast ?? []).filter((c) => s.generatedCharacterIds?.includes(c.id));
    if (!gen.length) throw new HttpError(409, "This story only used characters that are already in a library.");
    if (mine + gen.length > plan.privateCharacters) throw new HttpError(403, `Your ${plan.name} plan can save ${plan.privateCharacters} characters.`);
    s.generatedCharacterIds = [];
  });
  const saved: string[] = [];
  for (const c of gen) {
    const rec: CharacterRecord = {
      id: newId("chr"), ownerId: user.id, name: c.name, description: `From “${p.title}”.`, personality: "", style: p.style,
      appearance: c.appearance, visibility: "private", source: "creator", featured: false, reusePolicy: "owner_only", createdAt: now(), uses: 0,
    };
    await insertDoc("characters", rec.id, rec);
    saved.push(rec.id);
  }
  return json({ saved });
});

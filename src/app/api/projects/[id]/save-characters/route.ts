import { HttpError, requireUser } from "@/lib/server/auth";
import { getPlan } from "@/config/plans";
import { id as newId, now, tx } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";

/** Saves characters that were designed for this story into the user's library. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const saved = await tx((db) => {
    const p = db.projects.find((x) => x.id === id && x.userId === user.id);
    if (!p) throw new HttpError(404, "Project not found.");
    const story = db.stories.find((s) => s.projectId === p.id);
    const gen = (story?.cast ?? []).filter((c) => story?.generatedCharacterIds?.includes(c.id));
    if (!gen.length) throw new HttpError(409, "This story only used characters that are already in a library.");
    const plan = getPlan(db.subscriptions.find((s) => s.userId === user.id)?.planId);
    const mine = db.characters.filter((c) => c.ownerId === user.id).length;
    if (mine + gen.length > plan.privateCharacters) throw new HttpError(403, `Your ${plan.name} plan can save ${plan.privateCharacters} characters.`);
    const out = gen.map((c) => {
      const rec = {
        id: newId("chr"), ownerId: user.id, name: c.name, description: `From “${p.title}”.`, personality: "", style: p.style,
        appearance: c.appearance, visibility: "private" as const, source: "creator" as const, featured: false, reusePolicy: "owner_only" as const, createdAt: now(), uses: 0,
      };
      db.characters.push(rec);
      return rec.id;
    });
    // Point the story at the saved records so the save can't be repeated.
    story!.generatedCharacterIds = [];
    return out;
  });
  return json({ saved });
});

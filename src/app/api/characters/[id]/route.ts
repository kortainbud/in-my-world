import { HttpError, requireUser } from "@/lib/server/auth";
import { tx } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { parseCharacterFields } from "@/lib/server/characters";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const f = parseCharacterFields(await body(req));
  const rec = await tx((db) => {
    const c = db.characters.find((x) => x.id === id && x.ownerId === user.id);
    if (!c) throw new HttpError(404, "Character not found.");
    Object.assign(c, f, { source: f.visibility === "public" ? "community" : "creator" });
    return c;
  });
  return json({ character: rec });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  await tx((db) => {
    const c = db.characters.find((x) => x.id === id && x.ownerId === user.id);
    if (!c) throw new HttpError(404, "Character not found.");
    // Existing videos keep their rendered output; the character just can't be cast again.
    db.characters = db.characters.filter((x) => x.id !== id);
  });
  return json({ ok: true });
});

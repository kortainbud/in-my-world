import { HttpError, requireUser } from "@/lib/server/auth";
import type { CharacterRecord } from "@/lib/engine/characters";
import { deleteDocs, getDoc, mutateDoc } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import { parseCharacterFields } from "@/lib/server/characters";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const f = parseCharacterFields(await body(req));
  const rec = await mutateDoc<CharacterRecord>("characters", id, (c) => {
    if (c.ownerId !== user.id) throw new HttpError(404, "Character not found.");
    Object.assign(c, f, { source: f.visibility === "public" ? "community" : "creator" });
  });
  if (!rec) throw new HttpError(404, "Character not found.");
  return json({ character: rec });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const c = await getDoc<CharacterRecord>("characters", id);
  if (!c || c.ownerId !== user.id) throw new HttpError(404, "Character not found.");
  // Existing videos keep their rendered output; the character just can't be cast again.
  await deleteDocs("characters", (q) => q.eq("id", id).eq("owner_id", user.id));
  return json({ ok: true });
});

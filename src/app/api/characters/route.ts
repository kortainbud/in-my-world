import { currentUser, HttpError, requireUser } from "@/lib/server/auth";
import { getPlan } from "@/config/plans";
import { canCast, type CharacterRecord } from "@/lib/engine/characters";
import { id, now, read, tx } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";
import { libraryFor } from "@/lib/server/pipeline";
import { parseCharacterFields } from "@/lib/server/characters";

export const GET = route(async (req: Request) => {
  const user = await currentUser();
  const scope = new URL(req.url).searchParams.get("scope") ?? "library";
  const data = await read((db) => {
    const planId = user ? getPlan(db.subscriptions.find((s) => s.userId === user.id)?.planId).id : "free";
    let list = libraryFor(db, user?.id ?? null);
    if (scope === "mine") list = list.filter((c) => c.ownerId === user?.id);
    if (scope === "featured") list = list.filter((c) => c.featured);
    return list.map((c) => ({ ...c, cast: canCast(c, user ? { id: user.id, planId } : null), isMine: !!user && c.ownerId === user.id }));
  });
  return json({ characters: data });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const f = parseCharacterFields(await body(req));
  const rec = await tx((db) => {
    const plan = getPlan(db.subscriptions.find((s) => s.userId === user.id)?.planId);
    const count = db.characters.filter((c) => c.ownerId === user.id).length;
    if (count >= plan.privateCharacters) throw new HttpError(403, `Your ${plan.name} plan can save ${plan.privateCharacters} characters. Delete one or upgrade.`, "character_limit");
    const r: CharacterRecord = { id: id("chr"), ownerId: user.id, ...f, source: f.visibility === "public" ? "community" : "creator", featured: false, createdAt: now(), uses: 0 };
    db.characters.push(r);
    return r;
  });
  return json({ character: rec }, 201);
});

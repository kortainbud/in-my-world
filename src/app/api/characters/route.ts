import { currentUser, HttpError, requireUser } from "@/lib/server/auth";
import { canCast, type CharacterRecord } from "@/lib/engine/characters";
import { planFor } from "@/lib/server/credits";
import { countDocs, insertDoc, newId, now } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import { libraryFor } from "@/lib/server/pipeline";
import { parseCharacterFields } from "@/lib/server/characters";

export const GET = route(async (req: Request) => {
  const user = await currentUser();
  const scope = new URL(req.url).searchParams.get("scope") ?? "library";
  const planId = user ? (await planFor(user.id)).id : "free";
  let list = await libraryFor(user?.id ?? null);
  if (scope === "mine") list = list.filter((c) => c.ownerId === user?.id);
  if (scope === "featured") list = list.filter((c) => c.featured);
  return json({ characters: list.map((c) => ({ ...c, cast: canCast(c, user ? { id: user.id, planId } : null), isMine: !!user && c.ownerId === user.id })) });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const f = parseCharacterFields(await body(req));
  const plan = await planFor(user.id);
  const count = await countDocs("characters", (q) => q.eq("owner_id", user.id));
  if (count >= plan.privateCharacters) throw new HttpError(403, `Your ${plan.name} plan can save ${plan.privateCharacters} characters. Delete one or upgrade.`, "character_limit");
  const r: CharacterRecord = { id: newId("chr"), ownerId: user.id, ...f, source: f.visibility === "public" ? "community" : "creator", featured: false, createdAt: now(), uses: 0 };
  await insertDoc("characters", r.id, r);
  return json({ character: r }, 201);
});

import { HttpError, requireUser } from "@/lib/server/auth";
import { tx } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";

export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  const name = String(b.displayName ?? "").trim().slice(0, 40);
  const handle = String(b.handle ?? "").trim().toLowerCase();
  if (!name) throw new HttpError(400, "Display name can't be empty.");
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new HttpError(400, "Handles are 3–20 letters, numbers or underscores.");
  await tx((db) => {
    if (db.profiles.some((p) => p.handle === handle && p.userId !== user.id) || handle === "samples") throw new HttpError(409, "That handle is taken.");
    const p = db.profiles.find((x) => x.userId === user.id)!;
    p.displayName = name;
    p.handle = handle;
  });
  return json({ ok: true });
});

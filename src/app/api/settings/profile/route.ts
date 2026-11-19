import { HttpError, requireUser } from "@/lib/server/auth";
import { isUniqueViolation, mutateDoc } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import type { Profile } from "@/lib/server/models";

export const PATCH = route(async (req: Request) => {
  const user = await requireUser();
  const b = await body(req);
  const name = String(b.displayName ?? "").trim().slice(0, 40);
  const handle = String(b.handle ?? "").trim().toLowerCase();
  if (!name) throw new HttpError(400, "Display name can't be empty.");
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new HttpError(400, "Handles are 3–20 letters, numbers or underscores.");
  if (handle === "samples") throw new HttpError(409, "That handle is taken.");
  try {
    await mutateDoc<Profile>("profiles", user.id, (p) => {
      p.displayName = name;
      p.handle = handle;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "That handle is taken.");
    throw e;
  }
  return json({ ok: true });
});

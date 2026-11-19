import { createSession, HttpError, verifyPassword } from "@/lib/server/auth";
import { read } from "@/lib/server/db";
import { body, json, route } from "@/lib/server/http";

export const POST = route(async (req: Request) => {
  const b = await body(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const user = await read((db) => db.users.find((u) => u.email === email));
  const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) throw new HttpError(401, "That email and password don't match.");
  await createSession(user.id);
  return json({ ok: true });
});

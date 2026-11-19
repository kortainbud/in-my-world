import { createSession, HttpError, verifyPassword } from "@/lib/server/auth";
import { findOne } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import type { User } from "@/lib/server/models";

export const POST = route(async (req: Request) => {
  const b = await body(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const user = email ? await findOne<User>("users", (q) => q.eq("email", email)) : null;
  const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) throw new HttpError(401, "That email and password don't match.");
  await createSession(user.id);
  return json({ ok: true });
});

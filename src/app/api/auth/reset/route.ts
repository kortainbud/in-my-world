import crypto from "node:crypto";
import { createSession, hashPassword, HttpError } from "@/lib/server/auth";
import { deleteDocs, mutateDoc, takeDoc } from "@/lib/server/data";
import { body, json, route } from "@/lib/server/http";
import type { PasswordReset, User } from "@/lib/server/models";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Sets a new password from a reset link, signs out every other device and signs this one in. */
export const POST = route(async (req: Request) => {
  const b = await body(req);
  const token = String(b.token ?? "");
  const password = String(b.password ?? "");
  if (password.length < 8) throw new HttpError(400, "Use at least 8 characters for your password.");
  const r = token ? await takeDoc<PasswordReset>("password_resets", sha(token)) : null; // single use
  if (!r || new Date(r.expiresAt) < new Date()) throw new HttpError(400, "This reset link has expired or was already used. Ask for a new one.");
  const hash = await hashPassword(password);
  const user = await mutateDoc<User>("users", r.userId, (u) => void (u.passwordHash = hash));
  if (!user) throw new HttpError(400, "This account no longer exists.");
  await deleteDocs("sessions", (q) => q.eq("user_id", user.id));
  await deleteDocs("password_resets", (q) => q.eq("user_id", user.id));
  await createSession(user.id);
  return json({ ok: true });
});

import { createAccount, createSession, hashPassword, HttpError } from "@/lib/server/auth";
import { body, json, route } from "@/lib/server/http";

export const POST = route(async (req: Request) => {
  const b = await body(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const name = String(b.name ?? "").trim().slice(0, 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  if (password.length < 8) throw new HttpError(400, "Use at least 8 characters for your password.");
  if (!name) throw new HttpError(400, "Tell us what to call you.");
  const hash = await hashPassword(password);
  const user = await createAccount({ email, passwordHash: hash, displayName: name });
  await createSession(user.id);
  return json({ ok: true });
});

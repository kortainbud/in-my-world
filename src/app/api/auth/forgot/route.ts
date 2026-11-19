import crypto from "node:crypto";
import { HttpError } from "@/lib/server/auth";
import { MODE } from "@/lib/server/config";
import { countDocs, findOne, getDoc, insertDoc, now } from "@/lib/server/data";
import { emailEnabled, resetEmail, sendEmail, siteUrl } from "@/lib/server/email";
import { body, json, route } from "@/lib/server/http";
import type { PasswordReset, Profile, User } from "@/lib/server/models";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/**
 * Emails a one-time reset link. Always answers the same way, so it can't be
 * used to find out which emails have accounts.
 */
export const POST = route(async (req: Request) => {
  if (!emailEnabled() && MODE !== "development") throw new HttpError(503, "Password reset by email isn't available yet. Contact support to get back into your account.");
  const b = await body(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  const user = await findOne<User>("users", (q) => q.eq("email", email));
  if (user) {
    // At most 3 reset emails per account per hour.
    const recent = await countDocs("password_resets", (q) => q.eq("user_id", user.id).gte("created_at", new Date(Date.now() - 36e5).toISOString()));
    if (recent < 3) {
      const token = crypto.randomBytes(32).toString("base64url");
      const r: PasswordReset = { userId: user.id, createdAt: now(), expiresAt: new Date(Date.now() + 36e5).toISOString() };
      await insertDoc("password_resets", sha(token), r);
      const profile = await getDoc<Profile>("profiles", user.id);
      const mail = resetEmail(`${siteUrl(req)}/reset-password?token=${token}`, profile?.displayName ?? "there");
      try {
        await sendEmail({ to: email, ...mail });
      } catch (e) {
        console.error("[forgot]", e);
        throw new HttpError(502, "We couldn't send the email just now. Try again in a minute.");
      }
    }
  }
  return json({ ok: true });
});

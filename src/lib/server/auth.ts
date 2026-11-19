import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { getPlan } from "@/config/plans";
import { MODE } from "./config";
import { HttpError } from "./auth-errors";
import { deleteDocs, getDoc, insertDoc, isUniqueViolation, newId, now } from "./data";
import type { Profile, Session, Subscription, User } from "./models";

export { HttpError };

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const SESSION_COOKIE = "imw_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt") return false;
  const key = await scrypt(pw, Buffer.from(s, "base64"), 64);
  const expected = Buffer.from(k, "base64");
  return expected.length === key.length && crypto.timingSafeEqual(expected, key);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const s: Session = { tokenHash: sha(token), userId, createdAt: now(), expiresAt: expires.toISOString() };
  await insertDoc("sessions", s.tokenHash, s);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: MODE === "production", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteDocs("sessions", (q) => q.eq("id", sha(token)));
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await getDoc<Session>("sessions", sha(token));
  if (!s || new Date(s.expiresAt) < new Date()) return null;
  return getDoc<User>("users", s.userId);
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Sign in to continue.", "unauthenticated");
  return u;
}

/** Creates user + profile + free subscription + signup credits. */
export async function createAccount(opts: { email: string | null; passwordHash: string | null; displayName: string; id?: string; planId?: "free" | "creator" | "pro" }): Promise<User> {
  const user: User = { id: opts.id ?? newId("usr"), email: opts.email, passwordHash: opts.passwordHash, createdAt: now() };
  try {
    await insertDoc("users", user.id, user);
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "An account with this email already exists. Sign in instead.");
    throw e;
  }
  const base = opts.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "creator";
  for (let n = 1; ; n++) {
    const handle = n === 1 ? base : `${base}${n}`;
    try {
      const p: Profile = { userId: user.id, displayName: opts.displayName, handle, createdAt: now() };
      await insertDoc("profiles", user.id, p);
      break;
    } catch (e) {
      if (!isUniqueViolation(e) || n > 50) throw e;
    }
  }
  const plan = getPlan(opts.planId ?? "free");
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const sub: Subscription = { userId: user.id, planId: plan.id, status: "active", provider: "none", currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString() };
  await insertDoc("subscriptions", user.id, sub);
  const grant = { id: newId("ctx"), userId: user.id, amount: plan.monthlyCredits, kind: "grant_signup" as const, note: `${plan.name} plan — monthly allowance`, createdAt: now() };
  await insertDoc("credits", grant.id, grant);
  return user;
}

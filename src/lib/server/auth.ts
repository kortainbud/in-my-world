import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { MODE } from "./config";
import { id, now, read, tx } from "./db";
import type { DB, User } from "./models";
import { getPlan } from "@/config/plans";

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
  await tx((db) => {
    db.sessions = db.sessions.filter((s) => new Date(s.expiresAt) > new Date());
    db.sessions.push({ tokenHash: sha(token), userId, createdAt: now(), expiresAt: expires.toISOString() });
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: MODE === "production", path: "/", expires });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await tx((db) => void (db.sessions = db.sessions.filter((s) => s.tokenHash !== sha(token))));
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const h = sha(token);
  return read((db) => {
    const s = db.sessions.find((x) => x.tokenHash === h);
    if (!s || new Date(s.expiresAt) < new Date()) return null;
    return db.users.find((u) => u.id === s.userId) ?? null;
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Sign in to continue.", "unauthenticated");
  return u;
}

/** Creates user + profile + free subscription + signup credits. Call inside tx. */
export function createAccount(db: DB, opts: { email: string | null; passwordHash: string | null; displayName: string }): User {
  const user: User = { id: id("usr"), email: opts.email, passwordHash: opts.passwordHash, createdAt: now() };
  db.users.push(user);
  const base = opts.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "creator";
  let handle = base;
  let n = 1;
  while (db.profiles.some((p) => p.handle === handle)) handle = `${base}${++n}`;
  db.profiles.push({ userId: user.id, displayName: opts.displayName, handle, createdAt: now() });
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  db.subscriptions.push({ userId: user.id, planId: "free", status: "active", provider: "none", currentPeriodStart: start.toISOString(), currentPeriodEnd: end.toISOString() });
  db.credits.push({ id: id("ctx"), userId: user.id, amount: getPlan("free").monthlyCredits, kind: "grant_signup", note: "Free plan — monthly allowance", createdAt: now() });
  return user;
}

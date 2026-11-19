import "server-only";
import { createClient, type PostgrestFilterBuilder, type SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./auth-errors";

/**
 * Data access on Supabase (Postgres). Every table stores a JSON document in
 * `data` with indexed columns generated from it (see supabase/setup-v2.sql).
 * Updates are compare-and-swap on `version`, so concurrent requests on
 * serverless functions can't overwrite each other.
 */

export type Table =
  | "users" | "profiles" | "sessions" | "subscriptions" | "credits" | "projects" | "stories" | "jobs"
  | "videos" | "characters" | "payments" | "wallets" | "wallet_nonces" | "viewer_stats" | "sample_views" | "password_resets";

// Read at request time (not build time), and accept the common names, so a
// key added in the host's dashboard works without depending on the build.
const env = (k: string) => (process.env[k] ?? "").trim();
const supabaseUrl = () => env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = () => env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_KEY");

// The schema is JSON documents, so the client is untyped; documents are typed at each call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;
type G = { __imwSb?: Client };
const g = globalThis as G;

export function sb(): Client {
  if (g.__imwSb) return g.__imwSb;
  const url = supabaseUrl();
  const key = serviceKey();
  const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (missing.length) {
    console.error(`[data] missing environment variable(s): ${missing.join(", ")}`);
    throw new HttpError(503, `The database isn't configured: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} missing on the server.`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  g.__imwSb ??= createClient<any>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return g.__imwSb;
}

function fail(e: { message: string; code?: string } | null, what: string): never {
  if (e?.message?.includes("insufficient_credits")) throw new HttpError(402, "You don't have enough credits for that.", "insufficient_credits");
  if (e?.code === "23505") throw new HttpError(409, "That already exists.", "conflict");
  console.error(`[data] ${what}`, e);
  throw new HttpError(500, "Something went wrong on our side. Please try again.");
}

export function isUniqueViolation(e: unknown) {
  return e instanceof HttpError && e.code === "conflict";
}

type Row<T> = { id: string; data: T; version: number };

export async function getDoc<T>(t: Table, id: string): Promise<T | null> {
  const { data, error } = await sb().from(t).select("data").eq("id", id).maybeSingle();
  if (error) fail(error, `get ${t}`);
  return (data?.data as T) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = PostgrestFilterBuilder<any, any, any, any, any, any, any>;

/** Query with PostgREST filters on the generated columns. */
export async function findDocs<T>(t: Table, build: (q: Q) => Q = (q) => q): Promise<T[]> {
  const { data, error } = await build(sb().from(t).select("data") as unknown as Q);
  if (error) fail(error, `find ${t}`);
  return ((data ?? []) as { data: T }[]).map((r) => r.data);
}

export async function findIds(t: Table, build: (q: Q) => Q = (q) => q): Promise<string[]> {
  const { data, error } = await build(sb().from(t).select("id") as unknown as Q);
  if (error) fail(error, `ids ${t}`);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/** Fetch many documents by id in one round trip. */
export async function getMany<T>(t: Table, ids: string[]): Promise<Map<string, T>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data, error } = await sb().from(t).select("id,data").in("id", uniq);
  if (error) fail(error, `many ${t}`);
  return new Map(((data ?? []) as { id: string; data: T }[]).map((r) => [r.id, r.data]));
}

export async function findOne<T>(t: Table, build: (q: Q) => Q): Promise<T | null> {
  return (await findDocs<T>(t, (q) => build(q).limit(1)))[0] ?? null;
}

export async function countDocs(t: Table, build: (q: Q) => Q = (q) => q): Promise<number> {
  const { count, error } = await build(sb().from(t).select("id", { count: "exact", head: true }) as unknown as Q);
  if (error) fail(error, `count ${t}`);
  return count ?? 0;
}

export async function insertDoc<T>(t: Table, id: string, doc: T): Promise<T> {
  const { error } = await sb().from(t).insert({ id, data: doc });
  if (error) fail(error, `insert ${t}`);
  return doc;
}

export async function upsertDoc<T>(t: Table, id: string, doc: T): Promise<T> {
  const { error } = await sb().from(t).upsert({ id, data: doc });
  if (error) fail(error, `upsert ${t}`);
  return doc;
}

/**
 * Read-modify-write one document with compare-and-swap. `fn` mutates the
 * document in place (or returns a replacement); return `false` to abort
 * without writing. Retries on concurrent modification.
 */
export async function mutateDoc<T>(t: Table, id: string, fn: (doc: T) => void | boolean | T | Promise<void | boolean | T>, retries = 6): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    const { data, error } = await sb().from(t).select("id,data,version").eq("id", id).maybeSingle();
    if (error) fail(error, `read ${t}`);
    if (!data) return null;
    const row = data as unknown as Row<T>;
    const doc = structuredClone(row.data);
    const out = await fn(doc);
    if (out === false) return row.data;
    const next = out && out !== true ? (out as T) : doc;
    const { data: upd, error: e2 } = await sb().from(t).update({ data: next, version: row.version + 1 }).eq("id", id).eq("version", row.version).select("id");
    if (e2) fail(e2, `update ${t}`);
    if (upd && upd.length) return next;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
  }
  throw new HttpError(409, "That changed while we were saving it. Please try again.");
}

export async function deleteDocs(t: Table, build: (q: Q) => Q) {
  const { error } = await build(sb().from(t).delete() as unknown as Q);
  if (error) fail(error, `delete ${t}`);
}

/** Deletes and returns a document atomically (single-use tokens). */
export async function takeDoc<T>(t: Table, id: string): Promise<T | null> {
  const { data, error } = await sb().from(t).delete().eq("id", id).select("data");
  if (error) fail(error, `take ${t}`);
  return ((data ?? []) as { data: T }[])[0]?.data ?? null;
}

export async function creditBalance(userId: string): Promise<number> {
  const { data, error } = await sb().rpc("credit_balance", { uid: userId });
  if (error) fail(error, "balance");
  return Number(data) || 0;
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export const now = () => new Date().toISOString();

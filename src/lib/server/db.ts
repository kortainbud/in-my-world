import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./config";
import { emptyDB, type DB } from "./models";

/**
 * Local JSON store used in development. All mutations are serialised through
 * `tx`, and each write is atomic (write temp file, rename).
 *
 * The production schema lives in supabase/migrations — this store mirrors it
 * table-for-table so the data layer can be swapped.
 */
const FILE = path.join(DATA_DIR, "db.json");

type G = { __imwDb?: DB; __imwQueue?: Promise<unknown> };
const g = globalThis as G;

async function load(): Promise<DB> {
  if (g.__imwDb) return g.__imwDb;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    g.__imwDb = { ...emptyDB(), ...JSON.parse(raw) } as DB;
  } catch {
    g.__imwDb = emptyDB();
  }
  return g.__imwDb;
}

async function persist(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, FILE);
}

/** Read-only access. Do not mutate the returned data. */
export async function read<T>(fn: (db: DB) => T): Promise<T> {
  const db = await load();
  return fn(db);
}

/** Serialised read-modify-write. */
export function tx<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await load();
    const out = await fn(db);
    await persist(db);
    return out;
  };
  const p = (g.__imwQueue ?? Promise.resolve()).then(run, run);
  g.__imwQueue = p.catch(() => undefined);
  return p;
}

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export const now = () => new Date().toISOString();

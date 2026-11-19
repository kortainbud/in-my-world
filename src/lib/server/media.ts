import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./config";

/**
 * Local media storage (development). Keys look like "videos/vid_x.mp4".
 * In production this maps to Supabase Storage buckets with the same keys.
 */
const ROOT = path.join(DATA_DIR, "media");

function resolveKey(key: string) {
  if (!/^[a-z]+\/[A-Za-z0-9_.-]+$/.test(key)) throw new Error("Invalid media key");
  return path.join(ROOT, key);
}

export async function writeMedia(key: string, data: Buffer | Uint8Array) {
  const p = resolveKey(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  return key;
}

export async function mediaPath(key: string) {
  const p = resolveKey(key);
  await fs.access(p);
  return p;
}

export async function deleteMedia(key: string) {
  await fs.rm(resolveKey(key), { force: true });
}

export function mediaUrl(key: string) {
  return `/api/media/${key}`;
}

export const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".wav": "audio/wav",
  ".json": "application/json",
};

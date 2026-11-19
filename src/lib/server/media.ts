import "server-only";
import { sb } from "./data";

/**
 * Media lives in Supabase Storage. Keys look like "videos/vid_x.mp4": the
 * first segment is the bucket. Buckets are private; reads go through
 * short-lived signed URLs after an access check.
 */
const BUCKETS = new Set(["videos", "thumbs", "previews", "audio"]);

export function splitKey(key: string) {
  const m = /^([a-z]+)\/([A-Za-z0-9_.-]+)$/.exec(key);
  if (!m || !BUCKETS.has(m[1])) throw new Error("Invalid media key");
  return { bucket: m[1], path: m[2] };
}

const TYPES: Record<string, string> = { mp4: "video/mp4", jpg: "image/jpeg", wav: "audio/wav" };

export async function writeMedia(key: string, data: Buffer | Uint8Array) {
  const { bucket, path } = splitKey(key);
  const ext = path.split(".").pop() ?? "";
  const { error } = await sb().storage.from(bucket).upload(path, data, { contentType: TYPES[ext] ?? "application/octet-stream", upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return key;
}

/** A one-time URL the browser can upload a large file to directly. */
export async function signedUploadUrl(key: string) {
  const { bucket, path } = splitKey(key);
  const { data, error } = await sb().storage.from(bucket).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) throw new Error(`Couldn't create upload URL: ${error?.message}`);
  return { bucket, path, token: data.token, signedUrl: data.signedUrl };
}

export async function signedReadUrl(key: string, seconds = 3600, download?: string) {
  const { bucket, path } = splitKey(key);
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, seconds, download ? { download } : undefined);
  if (error || !data) return null;
  return data.signedUrl;
}

/** First bytes + size of a stored object (used to verify uploads). */
export async function inspectMedia(key: string, bytes = 32): Promise<{ size: number; head: Buffer } | null> {
  const url = await signedReadUrl(key, 60);
  if (!url) return null;
  const res = await fetch(url, { headers: { range: `bytes=0-${bytes - 1}` } });
  if (!res.ok && res.status !== 206) return null;
  const head = Buffer.from(await res.arrayBuffer());
  const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
  return { size: total, head };
}

export async function readMedia(key: string): Promise<Buffer> {
  const { bucket, path } = splitKey(key);
  const { data, error } = await sb().storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteMedia(keys: string[]) {
  const byBucket = new Map<string, string[]>();
  for (const k of keys) {
    try {
      const { bucket, path } = splitKey(k);
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
    } catch {}
  }
  for (const [bucket, paths] of byBucket) await sb().storage.from(bucket).remove(paths);
}

export function mediaUrl(key: string) {
  return `/api/media/${key}`;
}

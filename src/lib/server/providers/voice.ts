import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PROVIDERS } from "../config";
import { writeMedia } from "../media";
import { ProviderError } from "./story";

const run = promisify(execFile);

export interface VoiceOption {
  id: string;
  label: string;
  accent: string;
}

/** Narrator voices offered in the UI for the macOS dev provider. */
const SAY_NARRATORS: VoiceOption[] = [
  { id: "Samantha", label: "Sam", accent: "American" },
  { id: "Daniel", label: "Daniel", accent: "British" },
  { id: "Karen", label: "Karen", accent: "Australian" },
  { id: "Moira", label: "Moira", accent: "Irish" },
];

export function narratorVoices(): VoiceOption[] {
  return PROVIDERS.voice === "macos-say" ? SAY_NARRATORS : [];
}

export function defaultNarrator() {
  return narratorVoices()[0]?.id ?? null;
}

let sayVoices: Set<string> | null = null;
async function installedSayVoices() {
  if (sayVoices) return sayVoices;
  const { stdout } = await run("say", ["-v", "?"]);
  sayVoices = new Set(stdout.split("\n").map((l) => l.split(/\s{2,}/)[0]?.trim()).filter(Boolean));
  return sayVoices;
}

/** Reads the duration of a 16-bit PCM WAV from its header. */
function wavDuration(buf: Buffer) {
  const rate = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  const channels = buf.readUInt16LE(22);
  let off = 12;
  while (off < buf.length - 8) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") return size / (rate * channels * (bits / 8));
    off += 8 + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

export interface SpeechClip {
  mediaKey: string;
  duration: number;
}

/** Words per minute by delivery: faster for action, slower for revelations. */
const WPM: Record<string, number> = { fast: 198, normal: 178, slow: 156 };

export async function synthesize(text: string, voice: string, key: string, delivery: string = "normal"): Promise<SpeechClip> {
  if (PROVIDERS.voice !== "macos-say") throw new ProviderError("No voice provider is configured.");
  const installed = await installedSayVoices();
  const v = installed.has(voice) ? voice : "Samantha";
  const base = path.join(os.tmpdir(), `imw_${process.pid}_${Math.random().toString(36).slice(2)}`);
  const tmp = `${base}.wav`;
  const txt = `${base}.txt`;
  try {
    // Text goes through a file and execFile (no shell), so it can't be read as options.
    await fs.writeFile(txt, text, "utf8");
    await run("say", ["-v", v, "-r", String(WPM[delivery] ?? 178), "--file-format=WAVE", "--data-format=LEI16@24000", "-o", tmp, "-f", txt], { timeout: 60_000 });
    const buf = await fs.readFile(tmp);
    const duration = wavDuration(buf);
    await writeMedia(key, buf);
    return { mediaKey: key, duration };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("The voice provider failed to record narration.", true);
  } finally {
    await fs.rm(tmp, { force: true });
    await fs.rm(txt, { force: true });
  }
}

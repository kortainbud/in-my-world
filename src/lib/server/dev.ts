import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./auth";
import { MODE } from "./config";

export function requireDevMode() {
  if (MODE !== "development") throw new HttpError(404, "Not found.");
}

export const SAMPLE_PROMPTS: { prompt: string; style: "roblox" | "minecraft" }[] = [
  { prompt: "In my world, everyone grows taller every time they help someone.", style: "roblox" },
  { prompt: "In my world, everyone has a number above their head.", style: "minecraft" },
  { prompt: "In my world, money grows on trees.", style: "roblox" },
  { prompt: "In my world, nobody can tell a lie.", style: "minecraft" },
  { prompt: "In my world, your dreams appear on a screen above your bed.", style: "roblox" },
  { prompt: "In my world, everyone gets richer every time they tell a lie.", style: "minecraft" },
];

export async function copyToPublic(src: string, rel: string) {
  const dest = path.join(process.cwd(), "public", rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

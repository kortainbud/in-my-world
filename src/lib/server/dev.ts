import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./auth";
import { MODE } from "./config";

export function requireDevMode() {
  if (MODE !== "development") throw new HttpError(404, "Not found.");
}

export const SAMPLE_PROMPTS: { prompt: string; style: "roblox" | "minecraft"; format: "strange_world" | "mystery_series" | "impossible_choice" }[] = [
  { prompt: "In my town, nobody is allowed to look at the moon.", style: "roblox", format: "mystery_series" },
  { prompt: "In my town, lying is impossible. The moment you tell a lie, your shadow disappears.", style: "minecraft", format: "mystery_series" },
  { prompt: "In my town, nobody is allowed to sleep before 9 PM.", style: "roblox", format: "impossible_choice" },
  { prompt: "Every classroom in my school has a number. Except classroom 13.", style: "minecraft", format: "strange_world" },
  { prompt: "In my town, everything in the supermarket is free. But every item you take removes one memory.", style: "roblox", format: "strange_world" },
  { prompt: "In my city, nobody can move when the traffic lights turn red. Not even inside their homes.", style: "minecraft", format: "mystery_series" },
];

export async function copyToPublic(data: Buffer, rel: string) {
  const dest = path.join(process.cwd(), "public", rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, data);
}

import "server-only";
import { HttpError } from "./auth";
import type { CharacterRecord } from "@/lib/engine/characters";
import { ACCESSORIES, FACES, HAIR_STYLES, HATS, type Appearance } from "@/lib/engine/types";

const isHex = (s: unknown) => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);

export function parseAppearance(raw: unknown): Appearance {
  const a = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, list: readonly T[], d: T) => (list.includes(v as T) ? (v as T) : d);
  for (const k of ["skin", "hairColor", "top", "topAccent", "bottoms", "shoes", "hatColor", "accessoryColor"]) if (!isHex(a[k])) throw new HttpError(400, `Invalid colour for ${k}.`);
  return {
    skin: a.skin as string, hair: pick(a.hair, HAIR_STYLES, "short"), hairColor: a.hairColor as string, top: a.top as string, topAccent: a.topAccent as string,
    bottoms: a.bottoms as string, shoes: a.shoes as string, hat: pick(a.hat, HATS, "none"), hatColor: a.hatColor as string,
    accessory: pick(a.accessory, ACCESSORIES, "none"), accessoryColor: a.accessoryColor as string, face: pick(a.face, FACES, "smile"),
    height: Math.min(1.2, Math.max(0.85, Number(a.height) || 1)),
  };
}

export function parseCharacterFields(b: Record<string, unknown>) {
  const name = String(b.name ?? "").trim().slice(0, 32);
  if (!name) throw new HttpError(400, "Give your character a name.");
  return {
    name,
    description: String(b.description ?? "").trim().slice(0, 200),
    personality: String(b.personality ?? "").trim().slice(0, 200),
    style: (["roblox", "minecraft", "any"].includes(String(b.style)) ? b.style : "any") as CharacterRecord["style"],
    visibility: b.visibility === "public" ? ("public" as const) : ("private" as const),
    reusePolicy: b.reusePolicy === "anyone" ? ("anyone" as const) : ("owner_only" as const),
    appearance: parseAppearance(b.appearance),
  };
}


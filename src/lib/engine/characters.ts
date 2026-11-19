import type { Appearance, VisualStyle } from "./types";

export type CharacterSource = "official" | "community" | "creator" | "featured_personality" | "licensed";
export type ReusePolicy = "anyone" | "owner_only" | "paid_plans";
export type Visibility = "private" | "public";

export interface CharacterRecord {
  id: string;
  ownerId: string | null;
  name: string;
  description: string;
  personality: string;
  /** Styles this character has been designed for. Both styles render from the same appearance. */
  style: VisualStyle | "any";
  appearance: Appearance;
  voice?: string;
  visibility: Visibility;
  source: CharacterSource;
  featured: boolean;
  reusePolicy: ReusePolicy;
  /** Shown on featured personalities so it's clear content is sample / permission-based. */
  permissionNote?: string;
  createdAt: string;
  uses: number;
}

export const SOURCE_LABELS: Record<CharacterSource, string> = {
  official: "Official",
  community: "Community",
  creator: "Creator",
  featured_personality: "Featured personality",
  licensed: "Licensed",
};

export const REUSE_LABELS: Record<ReusePolicy, string> = {
  anyone: "Anyone can cast",
  owner_only: "Only the owner can cast",
  paid_plans: "Creator & Pro plans can cast",
};

const base: Appearance = {
  skin: "#F2C9A0",
  hair: "short",
  hairColor: "#3B2A20",
  top: "#3D7BF2",
  topAccent: "#FFFFFF",
  bottoms: "#2B2F3A",
  shoes: "#1A1A1A",
  hat: "none",
  hatColor: "#B9F36A",
  accessory: "none",
  accessoryColor: "#111111",
  face: "smile",
  height: 1,
};

const a = (p: Partial<Appearance>): Appearance => ({ ...base, ...p });
const T = "2026-11-19T00:00:00.000Z";

/** Official platform characters. Original designs. */
export const OFFICIAL_CHARACTERS: CharacterRecord[] = [
  {
    id: "ch_milo", ownerId: null, name: "Milo", style: "any",
    description: "Hoodie, headphones, always the first to try something new.",
    personality: "Curious, impulsive, says yes before thinking.",
    appearance: a({ top: "#F2643D", topAccent: "#FFD9C7", hat: "headphones", hatColor: "#202020", face: "grin" }),
    voice: "Eddy (English (US))", visibility: "public", source: "official", featured: true, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_juno", ownerId: null, name: "Juno", style: "any",
    description: "Track jacket, high bun, notebook full of plans.",
    personality: "Organised, sarcastic, secretly soft.",
    appearance: a({ skin: "#8D5A3B", hair: "bun", hairColor: "#16110E", top: "#7A5CFA", topAccent: "#EDE6FF", bottoms: "#E9E4DA", face: "cheeky" }),
    voice: "Flo (English (US))", visibility: "public", source: "official", featured: true, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_bricks", ownerId: null, name: "Bricks", style: "any",
    description: "Hard hat, hi-vis vest, builds anything in an afternoon.",
    personality: "Steady, literal, loves a plan.",
    appearance: a({ skin: "#C68B5E", hair: "none", top: "#F5C518", topAccent: "#F2F2F2", bottoms: "#365A9E", hat: "helmet", hatColor: "#FF9F1C", face: "determined", height: 1.12 }),
    voice: "Ralph", visibility: "public", source: "official", featured: false, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_pixel", ownerId: null, name: "Pixel", style: "any",
    description: "Tiny, fast, permanently online.",
    personality: "Chaotic, funny, terrible at secrets.",
    appearance: a({ skin: "#FFD7B0", hair: "spiky", hairColor: "#B9F36A", top: "#151515", topAccent: "#B9F36A", bottoms: "#151515", accessory: "shades", face: "grin", height: 0.88 }),
    voice: "Junior", visibility: "public", source: "official", featured: true, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_sage", ownerId: null, name: "Sage", style: "any",
    description: "Long coat, round glasses, knows how everything ends.",
    personality: "Calm, mysterious, a little dramatic.",
    appearance: a({ skin: "#E8B48F", hair: "long", hairColor: "#D8D3CC", top: "#2F4F46", topAccent: "#C9B67A", bottoms: "#22302B", accessory: "glasses", accessoryColor: "#C9B67A", face: "calm", height: 1.06 }),
    voice: "Moira", visibility: "public", source: "official", featured: false, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_rex", ownerId: null, name: "Rex", style: "any",
    description: "Gold chain, red cap, rich and wants you to know.",
    personality: "Loud, competitive, surprisingly generous.",
    appearance: a({ skin: "#6E4630", hair: "short", hairColor: "#0E0B09", top: "#FFFFFF", topAccent: "#E63946", bottoms: "#1D3557", hat: "cap", hatColor: "#E63946", accessory: "chain", accessoryColor: "#F2C14E", face: "cheeky" }),
    voice: "Reed (English (US))", visibility: "public", source: "official", featured: false, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_nova", ownerId: null, name: "Nova", style: "any",
    description: "Cape, crown, very serious about being in charge.",
    personality: "Bossy, theatrical, protective of her friends.",
    appearance: a({ skin: "#F5D0B5", hair: "curly", hairColor: "#C2410C", top: "#14213D", topAccent: "#FCA311", bottoms: "#14213D", hat: "crown", hatColor: "#FCA311", accessory: "cape", accessoryColor: "#9D0208", face: "determined" }),
    voice: "Kathy", visibility: "public", source: "official", featured: false, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_dot", ownerId: null, name: "Dot", style: "any",
    description: "Beanie, scarf, backpack — always halfway to somewhere.",
    personality: "Gentle, observant, narrates her own life.",
    appearance: a({ skin: "#A86B4C", hair: "short", hairColor: "#2A1B12", top: "#2A9D8F", topAccent: "#E9C46A", bottoms: "#264653", hat: "beanie", hatColor: "#E76F51", accessory: "backpack", accessoryColor: "#E9C46A", face: "smile", height: 0.95 }),
    voice: "Flo (English (UK))", visibility: "public", source: "official", featured: false, reusePolicy: "anyone", createdAt: T, uses: 0,
  },
  {
    id: "ch_odysseyyy", ownerId: null, name: "Odysseyyy", style: "any",
    description: "Sample featured personality. Mohawk, shades, mid-adventure at all times.",
    personality: "Fearless storyteller who turns every errand into an epic.",
    appearance: a({ skin: "#D9A47C", hair: "mohawk", hairColor: "#B9F36A", top: "#101010", topAccent: "#B9F36A", bottoms: "#303030", shoes: "#B9F36A", accessory: "shades", accessoryColor: "#0A0A0A", face: "determined", height: 1.08 }),
    voice: "Daniel", visibility: "public", source: "featured_personality", featured: true, reusePolicy: "paid_plans",
    permissionNote: "Sample featured personality for demonstration. Real featured personalities appear only with the person's permission.",
    createdAt: T, uses: 0,
  },
];

/** Builder options for the selection-based character creator. */
export const BUILDER = {
  skin: ["#FFE0C2", "#F2C9A0", "#E8B48F", "#D9A47C", "#C68B5E", "#A86B4C", "#8D5A3B", "#6E4630", "#4A2E1F"],
  colors: ["#F5F3EE", "#151515", "#3D7BF2", "#7A5CFA", "#F2643D", "#E63946", "#F5C518", "#2A9D8F", "#B9F36A", "#14213D", "#E76F51", "#FF8FB1"],
  hairColors: ["#16110E", "#3B2A20", "#7B4B2A", "#C2410C", "#E9C46A", "#D8D3CC", "#B9F36A", "#7A5CFA", "#FF8FB1"],
};

export function defaultAppearance(): Appearance {
  return { ...base };
}

export function canCast(c: CharacterRecord, user: { id: string; planId: string } | null): { ok: boolean; reason?: string } {
  if (c.ownerId && c.ownerId === user?.id) return { ok: true };
  if (c.visibility === "private") return { ok: false, reason: "This character is private." };
  if (c.reusePolicy === "owner_only") return { ok: false, reason: "The owner hasn't allowed reuse." };
  if (c.reusePolicy === "paid_plans" && (!user || user.planId === "free"))
    return { ok: false, reason: "Featured personalities can be cast on Creator and Pro plans." };
  return { ok: true };
}

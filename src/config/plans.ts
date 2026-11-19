/**
 * Commercial configuration. Every price, allowance and limit the product shows
 * or enforces comes from here — change it in one place.
 *
 * NOTE: the prices and allowances below are PLACEHOLDERS chosen so the UI has
 * something to render. They are not business decisions. Set real values before
 * launch.
 */
import type { DurationPreset, VisualStyle } from "@/lib/engine/types";

export type PlanId = "free" | "creator" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in USD cents. 0 = free. */
  priceMonthlyCents: number;
  /** Credits granted at the start of each monthly period. */
  monthlyCredits: number;
  maxDurationSec: DurationPreset;
  exportHeight: 720 | 1080;
  watermark: boolean;
  privateCharacters: number;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try it. Make something weird.",
    priceMonthlyCents: 0,
    monthlyCredits: 40,
    maxDurationSec: 90,
    exportHeight: 720,
    watermark: true,
    privateCharacters: 3,
    features: ["Videos up to 1½ minutes", "720p vertical export", "Both visual styles", "3 saved characters", "Small watermark"],
  },
  {
    id: "creator",
    name: "Creator",
    tagline: "For people who post every week.",
    priceMonthlyCents: 1200,
    monthlyCredits: 300,
    maxDurationSec: 90,
    exportHeight: 1080,
    watermark: false,
    privateCharacters: 25,
    features: ["Videos up to 1½ minutes", "1080p vertical export", "No watermark", "25 saved characters", "Featured characters"],
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For channels and teams shipping daily.",
    priceMonthlyCents: 3600,
    monthlyCredits: 1000,
    maxDurationSec: 90,
    exportHeight: 1080,
    watermark: false,
    privateCharacters: 200,
    features: ["Videos up to 1½ minutes", "1080p vertical export", "No watermark", "200 saved characters", "Priority rendering queue"],
  },
];

export function getPlan(id: PlanId | string | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** One-off credit packs (placeholder pricing). */
export const CREDIT_PACKS = [
  { id: "pack_100", credits: 100, priceCents: 500 },
  { id: "pack_500", credits: 500, priceCents: 2000 },
] as const;

/** Credit cost model. */
export const CREDIT_COSTS = {
  /** Base credits per duration preset — covers story + render. */
  base: { 30: 10, 60: 18, 90: 25 } as Record<DurationPreset, number>,
  /** Multiplier per visual style (voxel scenes are cheaper to render on a GPU farm, but kept equal for now). */
  style: { roblox: 1, minecraft: 1 } as Record<VisualStyle, number>,
  /** Added when narration is generated. */
  narration: { 30: 2, 60: 4, 90: 6 } as Record<DurationPreset, number>,
  /** Multiplier for 1080p over 720p. */
  quality: { 720: 1, 1080: 1.2 } as Record<720 | 1080, number>,
};

export interface CostBreakdown {
  total: number;
  lines: { label: string; credits: number }[];
}

export function estimateCredits(opts: {
  duration: DurationPreset;
  style: VisualStyle;
  narration: boolean;
  exportHeight: 720 | 1080;
}): CostBreakdown {
  const base = CREDIT_COSTS.base[opts.duration];
  const styled = Math.round(base * CREDIT_COSTS.style[opts.style]);
  const narration = opts.narration ? CREDIT_COSTS.narration[opts.duration] : 0;
  const subtotal = styled + narration;
  const total = Math.ceil(subtotal * CREDIT_COSTS.quality[opts.exportHeight]);
  const lines = [{ label: `${opts.duration}s story + render`, credits: styled }];
  if (narration) lines.push({ label: "Narration", credits: narration });
  if (total !== subtotal) lines.push({ label: `${opts.exportHeight}p export`, credits: total - subtotal });
  return { total, lines };
}

export function formatPrice(cents: number) {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

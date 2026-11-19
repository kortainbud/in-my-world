import type { VisualStyle } from "@/lib/engine/types";

export const SITE = {
  name: "In My World",
  promise: "Turn any idea into a whole world.",
  description:
    "Create hilarious stories, strange realities and cinematic animated videos from a single idea. No animation skills. No editing. Just imagine it.",
  contactEmail: "hello@example.com", // placeholder — set before launch
};

/**
 * Display labels for visual styles. The brief names them after the games that
 * inspired them; the rendered assets are original. Labels are configurable here
 * in case trademark review requires different wording.
 */
export const STYLE_LABELS: Record<VisualStyle, { label: string; blurb: string }> = {
  roblox: { label: "Roblox", blurb: "Smooth blocky avatars, bright plastic worlds" },
  minecraft: { label: "Minecraft", blurb: "Voxel everything, pixel textures" },
};

export const PROMPT_STARTERS = [
  "In my world...",
  "Imagine if...",
  "Nobody knows that...",
  "What if everyone...",
  "One day, I woke up...",
  "POV: You discover...",
];

export const CATEGORIES = ["Funny", "Strange", "Wholesome", "Drama", "Money", "Mystery"] as const;
export type Category = (typeof CATEGORIES)[number];

export const TEMPLATES: { id: string; title: string; prompt: string; category: Category }[] = [
  { id: "taller", title: "Kindness makes you taller", prompt: "In my world, everyone grows taller every time they help someone.", category: "Wholesome" },
  { id: "numbers", title: "The number above your head", prompt: "In my world, everyone has a number above their head.", category: "Mystery" },
  { id: "money-trees", title: "Money grows on trees", prompt: "In my world, money grows on trees.", category: "Money" },
  { id: "no-lies", title: "Nobody can lie", prompt: "In my world, nobody can tell a lie.", category: "Funny" },
  { id: "dream-screens", title: "Dreams on a screen", prompt: "In my world, your dreams appear on a screen above your bed.", category: "Strange" },
  { id: "richer-lies", title: "Lies make you rich", prompt: "In my world, everyone gets richer every time they tell a lie.", category: "Drama" },
  { id: "jump-tax", title: "Every jump costs a coin", prompt: "Imagine if every time you jumped, it cost you one coin.", category: "Funny" },
  { id: "silent-day", title: "The day everyone went silent", prompt: "One day, I woke up and nobody in my town could speak except me.", category: "Mystery" },
  { id: "pov-door", title: "The door behind the fridge", prompt: "POV: You discover a tiny door behind your fridge that leads to a second town.", category: "Strange" },
  { id: "compliment-coins", title: "Compliments are currency", prompt: "What if everyone paid for things with compliments instead of money?", category: "Wholesome" },
];

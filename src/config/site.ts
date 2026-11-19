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

export const TEMPLATES: { id: string; title: string; prompt: string; category: Category; format?: "strange_world" | "mystery_series" | "impossible_choice" }[] = [
  { id: "moon", title: "Don't look at the moon", prompt: "In my town, nobody is allowed to look at the moon.", category: "Mystery", format: "mystery_series" },
  { id: "shadows", title: "Lies cost your shadow", prompt: "In my town, lying is impossible. The moment you tell a lie, your shadow disappears.", category: "Mystery", format: "mystery_series" },
  { id: "sleep", title: "No sleep before nine", prompt: "In my town, nobody is allowed to sleep before 9 PM. Anyone who sleeps early wakes up in someone else's body.", category: "Strange", format: "impossible_choice" },
  { id: "classroom-13", title: "Classroom 13", prompt: "Every classroom in my school has a number. Except classroom 13.", category: "Mystery", format: "strange_world" },
  { id: "supermarket", title: "The free supermarket", prompt: "In my town, everything in the supermarket is free. But every item you take removes one memory.", category: "Strange", format: "strange_world" },
  { id: "red-light", title: "Red light city", prompt: "In my city, nobody can move when the traffic lights turn red. Not even inside their homes.", category: "Drama", format: "mystery_series" },
  { id: "houses", title: "The disappearing street", prompt: "Every night at midnight, one house on my street disappears.", category: "Mystery", format: "mystery_series" },
  { id: "mirrors", title: "One minute late", prompt: "In my house, the mirrors show you one minute late.", category: "Strange", format: "strange_world" },
  { id: "wish", title: "Thirteenth-birthday wish", prompt: "In my town, you get one wish on your thirteenth birthday. Whatever you wish for, someone else loses.", category: "Drama", format: "impossible_choice" },
  { id: "taller", title: "Kindness makes you taller", prompt: "In my world, everyone grows taller every time they help someone.", category: "Wholesome" },
  { id: "numbers", title: "The number above your head", prompt: "In my world, everyone has a number above their head.", category: "Mystery" },
  { id: "money-trees", title: "Money grows on trees", prompt: "In my world, money grows on trees.", category: "Money" },
  { id: "richer-lies", title: "Lies make you rich", prompt: "In my world, everyone gets richer every time they tell a lie.", category: "Money" },
  { id: "jump-tax", title: "Every jump costs a coin", prompt: "Imagine if every time you jumped, it cost you one coin.", category: "Funny" },
];

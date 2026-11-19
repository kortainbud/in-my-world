/**
 * Shared generation types. These are the contract between the story provider
 * (LLM or dev template), the server pipeline, and the renderer. Everything the
 * story can ask for is drawn from a fixed vocabulary the renderer can actually
 * produce — we never let the model invent assets we can't draw.
 */

export const VISUAL_STYLES = ["roblox", "minecraft"] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

export const DURATIONS = [30, 60, 90] as const;
export type DurationPreset = (typeof DURATIONS)[number];

export const ASPECTS = ["9:16"] as const;
export type Aspect = (typeof ASPECTS)[number];

export const ENVIRONMENTS = [
  "town_street",
  "park",
  "bedroom",
  "city_plaza",
  "school_hall",
  "office",
  "beach",
  "forest",
  "stage",
] as const;
export type EnvironmentKind = (typeof ENVIRONMENTS)[number];

export const TIMES_OF_DAY = ["day", "sunset", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const CAMERAS = [
  "wide",
  "medium",
  "close_up",
  "low_angle",
  "over_shoulder",
  "orbit",
  "dolly_in",
  "pan",
  "top_down",
] as const;
export type CameraMove = (typeof CAMERAS)[number];

export const ACTIONS = [
  "idle",
  "talk",
  "walk_in_left",
  "walk_in_right",
  "walk_across",
  "run",
  "wave",
  "jump",
  "celebrate",
  "dance",
  "point",
  "shrug",
  "sad",
  "shocked",
  "sit",
  "sleep",
  "look_up",
  "give",
  "grow",
  "shrink",
] as const;
export type Action = (typeof ACTIONS)[number];

export const EXPRESSIONS = ["happy", "neutral", "sad", "shocked", "angry", "smug", "sleepy"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const POSITIONS = ["left", "center", "right", "back_left", "back_right"] as const;
export type StagePosition = (typeof POSITIONS)[number];

export const PROPS = [
  "money_tree",
  "falling_money",
  "dream_screen",
  "trophy",
  "gift_box",
  "phone",
  "sparkles",
  "rain",
  "confetti",
  "question_marks",
  "hearts",
  "car",
  "crowd",
  "sign",
] as const;
export type PropKind = (typeof PROPS)[number];

export const SFX = [
  "pop",
  "whoosh",
  "ding",
  "boing",
  "coins",
  "magic",
  "thud",
  "alarm",
  "cheer",
  "heartbeat",
  "record_scratch",
  "drumroll",
] as const;
export type SfxKind = (typeof SFX)[number];

export const MUSIC_MOODS = ["playful", "mysterious", "epic", "chill", "tense"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

/* ---------- Characters ---------- */

export const HAIR_STYLES = ["none", "short", "spiky", "long", "bun", "curly", "mohawk"] as const;
export const HATS = ["none", "cap", "beanie", "crown", "headphones", "tophat", "helmet"] as const;
export const ACCESSORIES = ["none", "glasses", "shades", "backpack", "cape", "scarf", "chain"] as const;
export const FACES = ["smile", "grin", "calm", "cheeky", "determined"] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type Hat = (typeof HATS)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type FacePreset = (typeof FACES)[number];

export interface Appearance {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  top: string;
  topAccent: string;
  bottoms: string;
  shoes: string;
  hat: Hat;
  hatColor: string;
  accessory: Accessory;
  accessoryColor: string;
  face: FacePreset;
  /** Relative height, 0.85 – 1.2. */
  height: number;
}

export interface CharacterSpec {
  id: string;
  name: string;
  appearance: Appearance;
  /** Voice used when this character has a dialogue line. */
  voice?: string;
}

/* ---------- Story plan (what the story provider returns) ---------- */

export interface CastMember {
  /** Local reference used by scenes, e.g. "c1". */
  ref: string;
  name: string;
  role: string;
  /** Library character to reuse. When absent, `appearance` is used. */
  characterId?: string;
  appearance?: Appearance;
}

export interface SceneCharacter {
  ref: string;
  action: Action;
  position: StagePosition;
  expression: Expression;
  /** Text floating over the character's head (e.g. a number, a status). */
  label?: string;
  /** Scale multiplier applied at the end of the scene (growth stories). */
  scaleTo?: number;
}

export interface ScenePlan {
  narration: string;
  environment: EnvironmentKind;
  timeOfDay: TimeOfDay;
  camera: CameraMove;
  characters: SceneCharacter[];
  props: PropKind[];
  /** Text displayed on screens/signs when a prop supports it. */
  propText?: string;
  dialogue?: { ref: string; line: string };
  sfx: SfxKind[];
  /** Short description of what happens visually (used for previews/accessibility). */
  description: string;
}

export interface StoryPlan {
  title: string;
  premise: string;
  hook: string;
  ending: string;
  musicMood: MusicMood;
  cast: CastMember[];
  scenes: ScenePlan[];
}

/* ---------- Compiled timeline (what the renderer consumes) ---------- */

export interface AudioClip {
  /** Media URL served by the app. */
  url: string;
  start: number;
  duration: number;
  kind: "narration" | "dialogue";
}

export interface CaptionChunk {
  start: number;
  end: number;
  words: { text: string; start: number; end: number }[];
}

export interface SfxCue {
  kind: SfxKind;
  at: number;
}

export interface TimelineScene {
  index: number;
  start: number;
  duration: number;
  plan: ScenePlan;
  /** Camera seed for deterministic variation. */
  seed: number;
  dialogueWindow?: { start: number; end: number };
}

export interface Timeline {
  version: 1;
  style: VisualStyle;
  width: number;
  height: number;
  fps: number;
  duration: number;
  title: string;
  musicMood: MusicMood;
  cast: CharacterSpec[];
  /** Maps scene `ref`s to `cast` ids. */
  refs: Record<string, string>;
  scenes: TimelineScene[];
  audio: AudioClip[];
  captions: CaptionChunk[];
  sfx: SfxCue[];
  watermark: boolean;
  /** True when narration audio exists. */
  narrated: boolean;
}

/* ---------- Pipeline stages ---------- */

export const STAGES = [
  { key: "story", label: "Writing your story" },
  { key: "characters", label: "Building your characters" },
  { key: "world", label: "Creating your world" },
  { key: "animation", label: "Animating your scenes" },
  { key: "narration", label: "Recording narration" },
  { key: "editing", label: "Editing your video" },
  { key: "render", label: "Final rendering" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
export type StageStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface StageState {
  key: StageKey;
  status: StageStatus;
  startedAt?: string;
  endedAt?: string;
  detail?: string;
}

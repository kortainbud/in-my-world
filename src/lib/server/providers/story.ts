import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CharacterRecord } from "@/lib/engine/characters";
import { generateDevStory } from "@/lib/engine/devStory";
import { WORDS_PER_SECOND } from "@/lib/engine/compile";
import {
  ACCESSORIES, ACTIONS, CAMERAS, ENVIRONMENTS, EXPRESSIONS, FACES, HAIR_STYLES, HATS, MUSIC_MOODS, POSITIONS, PROPS, SFX, TIMES_OF_DAY,
  type DurationPreset, type StoryPlan, type VisualStyle,
} from "@/lib/engine/types";
import { PROVIDERS, STORY_MODEL } from "../config";

export class ProviderError extends Error {
  constructor(message: string, public retryable = false) {
    super(message);
  }
}

export interface StoryInput {
  prompt: string;
  duration: DurationPreset;
  style: VisualStyle;
  /** Characters the user explicitly cast. */
  cast: CharacterRecord[];
  /** Characters the model may choose from. */
  library: CharacterRecord[];
  seed?: string;
}

export interface StoryResult {
  plan: StoryPlan;
  source: "anthropic" | "dev-template";
  model?: string;
}

const hex = z.string().describe("CSS hex colour like #3D7BF2");

const PlanSchema = z.object({
  title: z.string().describe("Punchy title, max 6 words"),
  premise: z.string(),
  hook: z.string().describe("The opening line — must grab attention in under 2 seconds"),
  ending: z.string(),
  musicMood: z.enum(MUSIC_MOODS),
  cast: z
    .array(
      z.object({
        ref: z.string().describe("Short local id like c1, c2"),
        name: z.string(),
        role: z.string(),
        characterId: z.string().nullable().describe("Id from the character library to reuse, or null to design a new character"),
        appearance: z
          .object({
            skin: hex, hair: z.enum(HAIR_STYLES), hairColor: hex, top: hex, topAccent: hex, bottoms: hex, shoes: hex,
            hat: z.enum(HATS), hatColor: hex, accessory: z.enum(ACCESSORIES), accessoryColor: hex, face: z.enum(FACES),
            height: z.number().describe("0.85 to 1.2"),
          })
          .nullable()
          .describe("Required when characterId is null"),
      }),
    )
    .describe("1 to 4 characters"),
  scenes: z.array(
    z.object({
      narration: z.string().describe("Voice-over for this scene, conversational, 8-22 words"),
      description: z.string().describe("What we see, one sentence"),
      environment: z.enum(ENVIRONMENTS),
      timeOfDay: z.enum(TIMES_OF_DAY),
      camera: z.enum(CAMERAS),
      characters: z.array(
        z.object({
          ref: z.string(),
          action: z.enum(ACTIONS),
          position: z.enum(POSITIONS),
          expression: z.enum(EXPRESSIONS),
          label: z.string().nullable().describe("Short text floating over the head (a number, a status) or null"),
          scaleTo: z.number().nullable().describe("Body scale at end of scene for growth/shrink stories (0.5-2.6), or null"),
        }),
      ),
      props: z.array(z.enum(PROPS)),
      propText: z.string().nullable().describe("Text shown on dream_screen or sign props, max 5 words, or null"),
      dialogue: z.object({ ref: z.string(), line: z.string().describe("Max 10 words") }).nullable(),
      sfx: z.array(z.enum(SFX)),
    }),
  ),
});

const SYSTEM = `You are the head writer of a short-form animated video studio. You turn one-line ideas into scripts for 9:16 vertical videos that are rendered by a 3D engine with blocky avatar characters.

Write like the best storytelling TikToks: a hook in the first line, a strange rule explored with escalating, specific examples, a turn, and a payoff or twist ending. Conversational, funny, a little absurd, never cruel. Keep it suitable for a general audience.

The renderer can only draw what the schema allows: pick environments, actions, cameras, props and sound effects from the enums. Vary the camera between scenes. Every scene should have at least one character. Use labels for rules involving numbers or statuses, scaleTo for rules about size, dream_screen for dreams, money props for money rules. Dialogue is optional and short; narration carries the story.

Reuse characters from the provided library when they fit (set characterId). Any character the user explicitly cast MUST appear with their library id. Design new characters only when needed, with a coherent colour palette.`;

async function anthropicStory(input: StoryInput): Promise<StoryResult> {
  const client = new Anthropic();
  const sceneCount = { 30: "5 to 6", 60: "8 to 10", 90: "11 to 14" }[input.duration];
  const words = Math.round(input.duration * WORDS_PER_SECOND * 0.85);
  const library = input.library.map((c) => ({ id: c.id, name: c.name, description: c.description, personality: c.personality }));
  const user = [
    `Idea: ${input.prompt}`,
    `Target length: ${input.duration} seconds — ${sceneCount} scenes, about ${words} narration words in total.`,
    `Visual style: ${input.style} (affects rendering only).`,
    input.cast.length ? `Must cast: ${input.cast.map((c) => `${c.name} (${c.id})`).join(", ")}.` : "No characters were requested; choose from the library or design new ones.",
    `Character library (JSON): ${JSON.stringify(library)}`,
  ].join("\n");

  let res;
  try {
    res = await client.beta.messages.parse({
      model: STORY_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ProviderError("The story provider rejected our credentials. Check ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError("The story provider is rate-limiting requests. We'll retry.", true);
    if (e instanceof Anthropic.APIConnectionError) throw new ProviderError("Couldn't reach the story provider. We'll retry.", true);
    if (e instanceof Anthropic.APIError) throw new ProviderError(`Story provider error (${e.status ?? "unknown"}).`, (e.status ?? 500) >= 500);
    throw e;
  }
  if (res.stop_reason === "refusal") throw new ProviderError("The story provider declined this idea. Try rephrasing it.");
  const out = res.parsed_output;
  if (!out) throw new ProviderError("The story provider returned an unreadable script. We'll retry.", true);

  const refs = new Set(out.cast.map((c) => c.ref));
  const libIds = new Set(input.library.map((c) => c.id));
  const plan: StoryPlan = {
    title: out.title,
    premise: out.premise,
    hook: out.hook,
    ending: out.ending,
    musicMood: out.musicMood,
    cast: out.cast
      .filter((c) => (c.characterId && libIds.has(c.characterId)) || c.appearance)
      .map((c) => ({
        ref: c.ref,
        name: c.name,
        role: c.role,
        characterId: c.characterId && libIds.has(c.characterId) ? c.characterId : undefined,
        appearance: c.characterId && libIds.has(c.characterId) ? undefined : { ...c.appearance!, height: Math.min(1.2, Math.max(0.85, c.appearance!.height)) },
      })),
    scenes: out.scenes.map((s) => ({
      narration: s.narration,
      description: s.description,
      environment: s.environment,
      timeOfDay: s.timeOfDay,
      camera: s.camera,
      characters: s.characters
        .filter((c) => refs.has(c.ref))
        .map((c) => ({ ref: c.ref, action: c.action, position: c.position, expression: c.expression, label: c.label ?? undefined, scaleTo: c.scaleTo ?? undefined })),
      props: s.props,
      propText: s.propText ?? undefined,
      dialogue: s.dialogue && refs.has(s.dialogue.ref) ? s.dialogue : undefined,
      sfx: s.sfx,
    })),
  };
  if (plan.scenes.length < 3 || !plan.cast.length) throw new ProviderError("The story provider returned an incomplete script. We'll retry.", true);
  return { plan, source: "anthropic", model: res.model };
}

export async function generateStory(input: StoryInput): Promise<StoryResult> {
  if (PROVIDERS.story === "anthropic") return anthropicStory(input);
  if (PROVIDERS.story === "dev-template") {
    return { plan: generateDevStory({ prompt: input.prompt, duration: input.duration, cast: input.cast, seed: input.seed }), source: "dev-template" };
  }
  throw new ProviderError("No story provider is configured. Set ANTHROPIC_API_KEY (production) or run in development mode.");
}

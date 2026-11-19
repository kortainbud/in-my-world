import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CharacterRecord } from "@/lib/engine/characters";
import { generateDevStory } from "@/lib/engine/devStory";
import { WORDS_PER_SECOND } from "@/lib/engine/compile";
import { checkStory } from "@/lib/engine/checklist";
import { PREMISE_LIBRARY, type Premise } from "@/lib/engine/premises";
import { rng, hashString } from "@/lib/engine/rng";
import {
  ACCESSORIES, ACTIONS, ARCHETYPES, BEATS, CAMERAS, DELIVERIES, ENDING_DEVICES, ENVIRONMENTS, EXPRESSIONS, FACES, FORMATS, HAIR_STYLES, HATS,
  MUSIC_MOODS, POSITIONS, PROPS, SFX, SHOTS, TIMES_OF_DAY, TWIST_TYPES,
  type ChecklistItem, type DurationPreset, type StoryFormat, type StoryPlan, type VisualStyle,
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
  format: StoryFormat;
  /** Characters the user explicitly cast. */
  cast: CharacterRecord[];
  /** Characters the model may choose from. */
  library: CharacterRecord[];
  /** Previous episode, when continuing a series. */
  previous?: StoryPlan;
  seed?: string;
}

export interface StoryResult {
  plan: StoryPlan;
  source: "anthropic" | "dev-template";
  model?: string;
  checklist: ChecklistItem[];
  checklistSource: "editor" | "structure";
  revised: boolean;
}

/* ---------------- The studio's storytelling framework, as instructions ---------------- */

const FRAMEWORK = `You are the head writer of a small storytelling studio making short-form, vertical animated videos with blocky 3D avatars. Every video must make people stop scrolling, stay to understand, care about a character, be surprised, and want another episode.

Central principle: every story needs a RULE, a REASON TO CARE, something that THREATENS the rule, and a TWIST that changes everything.

THE 8-PART STRUCTURE (a guide, not a rigid formula; 30-second stories may merge discovery and twist)
1. Hook — an unusual premise that creates instant curiosity ("In my town, nobody is allowed to look at the moon.")
2. World rule — the one strange law, its consequence ("Anyone who looks at it disappears before sunrise.")
3. Character — someone with something to lose, to hide, or a reason to break the rule.
4. Escalation — each event makes it worse; three levels: something is wrong (curiosity) → it's happening to me (concern) → it's worse than expected (urgency).
5. Discovery — evidence the official explanation might be wrong.
6. Twist — one primary twist that recontextualises everything; surprising, but it makes sense looking back.
7. Cliffhanger — a new, consequential decision or situation.
8. Continuation — a reason to come back.

WORLD DESIGN — answer the five questions: what is the rule; why does everyone obey it; what happens when someone breaks it; who benefits; what is the secret behind it (the secret must pay off later).

CHARACTERS — roles: protagonist, rule-breaker, authority, secret keeper (roles can overlap). The protagonist has a desire, a vulnerability and a secret. Choices must cost them something they want.

TWIST TYPES — identity, rule_reversal, betrayal, consequence, perspective, loop. Use exactly one primary twist.

ENDINGS — closed_loop (resolves, then one unexpected final detail) or open_loop (unresolved, leads to another episode). Devices: impossible_decision, new_revelation, unexpected_arrival, new_danger, missing_information, time_pressure. Don't end on a generic engagement question. Give a satisfying revelation, then open the next mystery.

NARRATION — first person when it adds stakes; it should sound like someone telling you something that really happened to them. Short, direct, visual sentences. Put the important information at the end of the sentence. Don't explain what the audience can see. Use dialogue only when it reveals character or changes the situation. Every sentence must add information, tension or emotion — if removing it loses nothing, cut it. Bad: "The next morning, I proceeded to discover that something unusual had happened to my brother." Good: "The next morning, my brother was gone. But his shoes were still moving."

PACING — set delivery "fast" for action/escalation, "slow" for revelations, and pauseBefore=true right before the twist (silence makes the next line land).

VISUAL GRAMMAR — tag each scene with a shot: establishing (show the place), character (expressions, reactions, dialogue), suspense (darkness, unusual angles, hidden details), reveal (transformations, dramatic camera). Don't repeat visuals. Show, don't tell: if someone disappears, show abandoned_shoes, an open_door, fog or flicker_lights rather than an empty room. Use noShadow / fading on characters when the story is about shadows, invisibility or disappearing. Use labels for numbers/statuses and scaleTo for size rules.

SOUND — pick sfx that support the beat: impact on the twist, heartbeat/glitch in escalation, knock/footsteps/door_creak for arrivals, alarm for time pressure.

FORMATS — strange_world: one rule governs a society, someone breaks it, consequences follow (can be standalone). mystery_series: each episode reveals one piece of a larger mystery and ends open_loop. impossible_choice: the protagonist faces two options each with a cost; put the choice on the cliffhanger scene (choice.question + two short options) and use the impossible_decision device.

ORIGINALITY — stories must feel original, never reskins of viral videos. Keep content suitable for a general audience: eerie and emotional is fine; no gore.

The renderer can only draw what the schema allows. Pick environments, actions, cameras, props and sound effects from the enums. Every scene needs at least one character on screen.`;

const hex = z.string().describe("CSS hex colour like #3D7BF2");

const SheetSchema = z.object({
  premise: z.string().describe("One sentence: In my town, ___"),
  rule: z.string().describe("Everyone must ___, otherwise ___"),
  whyObey: z.string(),
  breakConsequence: z.string(),
  beneficiary: z.string(),
  secret: z.string().describe("The hidden truth behind the rule"),
  protagonist: z.object({ name: z.string(), desire: z.string(), vulnerability: z.string(), secret: z.string() }),
  conflict: z.string(),
  escalation: z.array(z.string()).describe("Exactly three: curiosity, concern, urgency"),
  mystery: z.string(),
  twistType: z.enum(TWIST_TYPES),
  twist: z.string(),
  endingType: z.enum(["closed_loop", "open_loop"]),
  endingDevice: z.enum(ENDING_DEVICES),
  ending: z.string(),
  continuation: z.string().describe("The new question that makes viewers want another episode"),
});

const PlanSchema = z.object({
  title: z.string().describe("Punchy title, max 6 words"),
  sheet: SheetSchema,
  musicMood: z.enum(MUSIC_MOODS),
  cast: z
    .array(
      z.object({
        ref: z.string().describe("Short local id like c1, c2"),
        name: z.string(),
        role: z.string(),
        archetype: z.enum(ARCHETYPES),
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
    .describe("2 to 4 characters; the protagonist first"),
  scenes: z.array(
    z.object({
      beat: z.enum(BEATS),
      shot: z.enum(SHOTS),
      delivery: z.enum(DELIVERIES),
      pauseBefore: z.boolean(),
      narration: z.string().describe("Voice-over for this scene, 6-20 words, short sentences"),
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
          label: z.string().nullable().describe("Short text floating over the head, or null"),
          scaleTo: z.number().nullable().describe("Body scale at end of scene (0.5-2.6), or null"),
          noShadow: z.boolean(),
          fading: z.boolean(),
        }),
      ),
      props: z.array(z.enum(PROPS)),
      propText: z.string().nullable().describe("Text on a sign or dream_screen, max 5 words, or null"),
      dialogue: z.object({ ref: z.string(), line: z.string().describe("Max 10 words") }).nullable(),
      sfx: z.array(z.enum(SFX)),
      choice: z.object({ question: z.string(), options: z.array(z.string()).describe("Exactly two, max 4 words each") }).nullable(),
    }),
  ),
});

const ReviewSchema = z.object({
  items: z.array(z.object({ key: z.string(), pass: z.boolean(), note: z.string() })),
  revise: z.boolean().describe("True if the story should be rewritten to fix failed items"),
  notes: z.string().describe("Concrete rewrite instructions if revise is true"),
});

function client() {
  return new Anthropic();
}

function mapError(e: unknown): never {
  if (e instanceof Anthropic.AuthenticationError) throw new ProviderError("The story provider rejected our credentials. Check ANTHROPIC_API_KEY.");
  if (e instanceof Anthropic.RateLimitError) throw new ProviderError("The story provider is rate-limiting requests. We'll retry.", true);
  if (e instanceof Anthropic.APIConnectionError) throw new ProviderError("Couldn't reach the story provider. We'll retry.", true);
  if (e instanceof Anthropic.APIError) throw new ProviderError(`Story provider error (${e.status ?? "unknown"}).`, (e.status ?? 500) >= 500);
  throw e;
}

type Parsed = z.infer<typeof PlanSchema>;

async function write(input: StoryInput, revisionNotes?: { draft: Parsed; notes: string }) {
  const sceneCount = { 30: "5 to 6", 60: "10 to 12", 90: "14 to 17" }[input.duration];
  const words = Math.round(input.duration * WORDS_PER_SECOND * 0.92);
  const library = input.library.map((c) => ({ id: c.id, name: c.name, description: c.description, personality: c.personality }));
  const parts = [
    `Idea: ${input.prompt}`,
    `Format: ${input.format}.`,
    `Target length: about ${input.duration} seconds — ${sceneCount} scenes, about ${words} narration words in total. It's fine to run a little over; never pad.`,
    input.duration > 30
      ? "Use the extra time to develop the story, not to repeat it: show the protagonist testing or bending the rule, a setback that raises the stakes, a moment with the friend that makes the loss hurt, a clue the audience can catch before the twist, and a confrontation before the reveal. Every scene must change something."
      : "Keep it tight: hook, rule, one escalation, twist, cliffhanger.",
    `Visual style: ${input.style} (rendering only).`,
    input.cast.length ? `Must cast (protagonist first): ${input.cast.map((c) => `${c.name} (${c.id})`).join(", ")}.` : "No characters were requested; choose from the library or design new ones.",
    `Character library (JSON): ${JSON.stringify(library)}`,
  ];
  if (input.previous) {
    parts.push(
      `This is episode ${(input.previous.episode ?? 1) + 1} of a series. Keep the same world, rule and cast (reuse the same characterIds and refs). Open with a one-line recap, answer one question from last time, use a DIFFERENT twist type than ${input.previous.sheet?.twistType ?? "last time"}, and end open_loop.`,
      `Previous episode (JSON): ${JSON.stringify({ title: input.previous.title, sheet: input.previous.sheet, cast: input.previous.cast, lastScene: input.previous.scenes.at(-1)?.narration })}`,
    );
  }
  if (revisionNotes) parts.push(`Your editor sent this draft back. Rewrite it fully, fixing: ${revisionNotes.notes}`, `Draft (JSON): ${JSON.stringify(revisionNotes.draft)}`);
  try {
    const res = await client().beta.messages.parse({
      model: STORY_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
      system: FRAMEWORK,
      messages: [{ role: "user", content: parts.join("\n") }],
    });
    if (res.stop_reason === "refusal") throw new ProviderError("The story provider declined this idea. Try rephrasing it.");
    if (!res.parsed_output) throw new ProviderError("The story provider returned an unreadable script. We'll retry.", true);
    return { out: res.parsed_output, model: res.model };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    return mapError(e);
  }
}

async function review(draft: Parsed) {
  try {
    const res = await client().beta.messages.parse({
      model: STORY_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ReviewSchema) },
      system: `${FRAMEWORK}\n\nYou are now the studio's editor. Grade the draft against the editorial checklist. Use exactly these keys: premise (interesting premise), rule (clear understandable rule), stakes (protagonist has something meaningful to lose), escalation (escalates rather than repeats), twist (changes the audience's understanding), narration (natural and conversational), visuals (show what narration cannot), sound (reinforces the emotional progression), ending (resolves something or opens a genuinely interesting question), original (not a reskin of a viral video). Be strict but fair. Ask for a revision only if a failure would noticeably hurt retention.`,
      messages: [{ role: "user", content: JSON.stringify(draft) }],
    });
    return res.parsed_output;
  } catch {
    return null; // The editor is advisory — never fail a video because of it.
  }
}

function toPlan(out: Parsed, input: StoryInput): StoryPlan {
  const refs = new Set(out.cast.map((c) => c.ref));
  const libIds = new Set(input.library.map((c) => c.id));
  return {
    format: input.format,
    episode: (input.previous?.episode ?? 0) + 1,
    sheet: { ...out.sheet, escalation: [out.sheet.escalation[0] ?? "", out.sheet.escalation[1] ?? "", out.sheet.escalation[2] ?? ""] },
    title: out.title,
    premise: out.sheet.premise,
    hook: out.scenes[0]?.narration ?? out.sheet.premise,
    ending: out.scenes.at(-1)?.narration ?? out.sheet.ending,
    musicMood: out.musicMood,
    cast: out.cast
      .filter((c) => (c.characterId && libIds.has(c.characterId)) || c.appearance)
      .map((c) => ({
        ref: c.ref,
        name: c.name,
        role: c.role,
        archetype: c.archetype,
        characterId: c.characterId && libIds.has(c.characterId) ? c.characterId : undefined,
        appearance: c.characterId && libIds.has(c.characterId) ? undefined : { ...c.appearance!, height: Math.min(1.2, Math.max(0.85, c.appearance!.height)) },
      })),
    scenes: out.scenes.map((s) => ({
      beat: s.beat,
      shot: s.shot,
      delivery: s.delivery,
      pauseBefore: s.pauseBefore,
      narration: s.narration,
      description: s.description,
      environment: s.environment,
      timeOfDay: s.timeOfDay,
      camera: s.camera,
      characters: s.characters
        .filter((c) => refs.has(c.ref))
        .map((c) => ({ ref: c.ref, action: c.action, position: c.position, expression: c.expression, label: c.label ?? undefined, scaleTo: c.scaleTo ?? undefined, noShadow: c.noShadow || undefined, fading: c.fading || undefined })),
      props: s.props,
      propText: s.propText ?? undefined,
      dialogue: s.dialogue && refs.has(s.dialogue.ref) ? s.dialogue : undefined,
      sfx: s.sfx,
      choice: s.choice && s.choice.options.length >= 2 ? { question: s.choice.question, options: [s.choice.options[0], s.choice.options[1]] } : undefined,
    })),
  };
}

async function anthropicStory(input: StoryInput): Promise<StoryResult> {
  let { out, model } = await write(input);
  let revised = false;
  let verdict = await review(out);
  if (verdict?.revise) {
    const second = await write(input, { draft: out, notes: verdict.notes });
    out = second.out;
    model = second.model;
    revised = true;
    verdict = (await review(out)) ?? verdict;
  }
  const plan = toPlan(out, input);
  if (plan.scenes.length < 3 || !plan.cast.length) throw new ProviderError("The story provider returned an incomplete script. We'll retry.", true);
  const structure = checkStory(plan);
  const checklist = structure.map((item) => {
    const v = verdict?.items.find((x) => x.key === item.key);
    // Structural failures win; otherwise use the editor's judgement.
    return item.pass === false ? item : v ? { ...item, pass: v.pass, note: v.note } : item;
  });
  return { plan, source: "anthropic", model, checklist, checklistSource: verdict ? "editor" : "structure", revised };
}

export async function generateStory(input: StoryInput): Promise<StoryResult> {
  if (PROVIDERS.story === "anthropic") return anthropicStory(input);
  if (PROVIDERS.story === "dev-template") {
    const plan = generateDevStory({ prompt: input.prompt, duration: input.duration, cast: input.cast, seed: input.seed, format: input.format, previous: input.previous });
    return { plan, source: "dev-template", checklist: checkStory(plan), checklistSource: "structure", revised: false };
  }
  throw new ProviderError("No story provider is configured. Set ANTHROPIC_API_KEY (production) or run in development mode.");
}

/* ---------------- Concept development: premise ideas ---------------- */

const PremiseSchema = z.object({
  premises: z.array(z.object({ premise: z.string(), rule: z.string(), secret: z.string(), format: z.enum(FORMATS), why: z.string().describe("One line: why this will stop the scroll") })),
});

export async function generatePremises(opts: { seed?: string; count: number; avoid: string[] }): Promise<{ premises: Premise[]; source: "anthropic" | "library" }> {
  if (PROVIDERS.story === "anthropic") {
    try {
      const res = await client().beta.messages.parse({
        model: STORY_MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(PremiseSchema) },
        system: FRAMEWORK,
        messages: [{ role: "user", content: `Generate ${opts.count} original premises built on one simple, strange rule each, with a hidden secret behind the rule. Vary settings (towns, schools, homes, cities) and formats.${opts.seed ? ` Theme or seed: ${opts.seed}.` : ""} Avoid these: ${opts.avoid.join(" | ") || "none"}.` }],
      });
      if (res.parsed_output) return { premises: res.parsed_output.premises.slice(0, opts.count), source: "anthropic" };
    } catch (e) {
      mapError(e);
    }
  }
  const r = rng(hashString((opts.seed ?? "") + Date.now()));
  const pool = PREMISE_LIBRARY.filter((p) => !opts.avoid.includes(p.premise));
  const matches = opts.seed ? pool.filter((p) => (p.premise + p.rule + p.secret).toLowerCase().includes(opts.seed!.toLowerCase())) : [];
  return { premises: [...matches, ...r.shuffle(pool.filter((p) => !matches.includes(p)))].slice(0, opts.count), source: "library" };
}

/**
 * Development story engine.
 *
 * A deterministic template engine used when no LLM provider is configured.
 * It is NOT AI. It follows the studio's storytelling framework:
 *   hook → world rule → character → escalation (curiosity → concern → urgency)
 *   → discovery → twist → cliffhanger → continuation
 * Prompts that match one of the hand-written story kits use that story;
 * anything else gets a framework story assembled from beat pools.
 */
import type { CharacterRecord } from "./characters";
import { OFFICIAL_CHARACTERS } from "./characters";
import { KITS, type KitScene, type StoryKit } from "./kits";
import { hashString, rng } from "./rng";
import type {
  Action, Beat, CameraMove, CastMember, Delivery, DurationPreset, EndingDevice, EnvironmentKind, Expression, MusicMood, PropKind,
  SceneCharacter, ScenePlan, ShotType, StoryFormat, StoryPlan, StorySheet, TimeOfDay, TwistType,
} from "./types";
import { ENDING_DEVICES, TWIST_TYPES } from "./types";

type Theme = "money" | "grow" | "numbers" | "dream" | "truth" | "silence" | "discover" | "jump" | "kind" | "generic";

const THEME_TESTS: [Theme, RegExp][] = [
  ["dream", /\bdream|asleep|sleep|bed\b|nightmare/i],
  ["numbers", /\bnumber|score|count|level|rating/i],
  ["money", /\bmoney|rich|coin|cash|dollar|pay|price|cost|gold/i],
  ["grow", /\btall|grow|bigger|giant|shrink|tiny|small/i],
  ["truth", /\blie|lying|liar|truth|honest/i],
  ["silence", /\bspeak|talk|voice|silent|quiet|words/i],
  ["discover", /\bdiscover|door|secret|portal|hidden|find/i],
  ["jump", /\bjump/i],
  ["kind", /\bhelp|kind|compliment|nice|hug/i],
];

export function detectThemes(prompt: string): Theme[] {
  const found = THEME_TESTS.filter(([, re]) => re.test(prompt)).map(([t]) => t);
  return found.length ? found : ["generic"];
}

function cleanPrompt(prompt: string) {
  let p = prompt.trim().replace(/\s+/g, " ");
  if (!/[.!?…]$/.test(p)) p += ".";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function ruleClause(prompt: string) {
  return prompt
    .replace(/^(in my (world|town|city|school)|imagine if|nobody knows that|what if|one day,? i woke up( and)?|pov:? you discover)[,:]?\s*/i, "")
    .replace(/[.!?…]+$/, "")
    .trim();
}

function titleFrom(prompt: string) {
  const stripped = ruleClause(prompt);
  const words = stripped.split(" ").filter(Boolean);
  const cap = (w: string[]) => w.join(" ").replace(/^\w/, (c) => c.toUpperCase());
  if (words.length > 0 && words.length <= 6) return cap(words);
  const clause = stripped.split(/[,;:—-]/)[0].trim().split(" ").filter(Boolean);
  if (clause.length >= 2 && clause.length <= 6) return cap(clause);
  return cap(words.slice(0, 5));
}

/* ---------------- Visual grammar ---------------- */

const SHOT_FOR: Record<Beat, ShotType> = {
  hook: "establishing", rule: "establishing", character: "character", escalation_1: "character", escalation_2: "suspense",
  escalation_3: "suspense", discovery: "character", twist: "reveal", cliffhanger: "suspense", continuation: "reveal",
};
const CAMERAS_FOR: Record<ShotType, CameraMove[]> = {
  establishing: ["dolly_in", "wide", "pan"],
  character: ["medium", "close_up", "over_shoulder"],
  suspense: ["low_angle", "top_down", "dolly_in"],
  reveal: ["orbit", "dolly_in", "close_up"],
};
const DELIVERY_FOR: Record<Beat, Delivery> = {
  hook: "normal", rule: "normal", character: "normal", escalation_1: "fast", escalation_2: "fast", escalation_3: "fast",
  discovery: "normal", twist: "slow", cliffhanger: "slow", continuation: "slow",
};

/** Beats included per duration (90s adds extra scenes on top of the 60s set). */
const BEATS_FOR: Record<DurationPreset, Beat[]> = {
  30: ["hook", "rule", "escalation_2", "twist", "cliffhanger"],
  60: ["hook", "rule", "character", "escalation_1", "escalation_2", "escalation_3", "discovery", "twist", "cliffhanger", "continuation"],
  90: ["hook", "rule", "character", "escalation_1", "escalation_2", "escalation_3", "discovery", "twist", "cliffhanger", "continuation"],
};

/* ---------------- Casting: the four roles ---------------- */

interface Roles {
  P: CastMember;
  F: CastMember;
  A: CastMember;
  S: CastMember;
}

function castRoles(chosenIn: CharacterRecord[], r: ReturnType<typeof rng>): Roles {
  const pool = r.shuffle(OFFICIAL_CHARACTERS.filter((c) => c.reusePolicy === "anyone"));
  const chosen = [...chosenIn];
  const taken = (id: string) => chosen.some((x) => x.id === id);
  const authority = ["ch_nova", "ch_rex", "ch_bricks"].map((id) => pool.find((c) => c.id === id)).find((c) => c && !taken(c.id));
  const keeper = ["ch_sage", "ch_dot"].map((id) => pool.find((c) => c.id === id)).find((c) => c && !taken(c.id) && c.id !== authority?.id);
  for (const c of pool) {
    if (chosen.length >= 2) break;
    if (!taken(c.id) && c.id !== authority?.id && c.id !== keeper?.id) chosen.push(c);
  }
  const A = chosen[2] ?? authority ?? pool[2];
  const S = chosen[3] ?? keeper ?? pool[3];
  const m = (rec: CharacterRecord, ref: string, role: string, archetype: CastMember["archetype"]): CastMember => ({ ref, name: rec.name, role, archetype, characterId: rec.id });
  return {
    P: m(chosen[0], "c1", "Narrator", "protagonist"),
    F: m(chosen[1], "c2", "Rule-breaker", "rule_breaker"),
    A: m(A, "c3", "Authority", "authority"),
    S: m(S, "c4", "Secret keeper", "secret_keeper"),
  };
}

/* ---------------- Assembly ---------------- */

const fill = (s: string, R: Roles) => s.replace(/\{P\}/g, R.P.name).replace(/\{F\}/g, R.F.name).replace(/\{A\}/g, R.A.name).replace(/\{S\}/g, R.S.name);

function sceneFrom(k: KitScene, R: Roles, r: ReturnType<typeof rng>, fallbackEnv: EnvironmentKind): ScenePlan {
  const shot = SHOT_FOR[k.beat];
  const list = k.cast ?? [{ who: "P" as const }];
  const characters: SceneCharacter[] = list.map((c, i) => ({
    ref: R[c.who].ref,
    action: (c.action ?? "idle") as Action,
    position: (list.length > 1 ? (i === 0 ? "left" : "right") : "center") as SceneCharacter["position"],
    expression: (c.expression ?? "neutral") as Expression,
    label: c.label,
    noShadow: c.noShadow,
    fading: c.fading,
  }));
  return {
    beat: k.beat,
    shot,
    delivery: DELIVERY_FOR[k.beat],
    pauseBefore: k.beat === "twist" || k.beat === "continuation",
    narration: fill(k.line, R),
    description: fill(k.line, R),
    environment: k.env ?? fallbackEnv,
    timeOfDay: k.time ?? (shot === "suspense" ? "night" : "day"),
    camera: r.pick(CAMERAS_FOR[shot]),
    characters,
    props: [...new Set(k.props ?? [])],
    propText: k.propText,
    dialogue: k.dialogue ? { ref: R[k.dialogue.who].ref, line: fill(k.dialogue.line, R) } : undefined,
    sfx: k.sfx ?? (k.beat === "twist" ? ["impact"] : []),
    choice: k.choice,
  };
}

function fromKit(kit: StoryKit, duration: DurationPreset, R: Roles, r: ReturnType<typeof rng>, format: StoryFormat): StoryPlan {
  const list: KitScene[] = (duration === 30 ? kit.scenes.filter((s) => s.core) : kit.scenes).map((s) => ({ ...s }));
  if (duration === 90) {
    for (const ex of kit.extras) {
      const i = list.map((s) => s.beat).lastIndexOf(ex.after);
      list.splice(i + 1, 0, { ...ex });
    }
  }
  if (format === "impossible_choice" && !list.some((s) => s.choice)) {
    const cl = [...list].reverse().find((s) => s.beat === "cliffhanger") ?? list[list.length - 1];
    cl.choice = { question: "What do I do now?", options: ["Run", "Stay and find out"] };
  }
  const scenes = list.map((k) => sceneFrom(k, R, r, "town_street"));
  const sheet: StorySheet = {
    ...kit.sheet,
    beneficiary: fill(kit.sheet.beneficiary, R),
    secret: fill(kit.sheet.secret, R),
    conflict: fill(kit.sheet.conflict, R),
    escalation: kit.sheet.escalation.map((e) => fill(e, R)) as StorySheet["escalation"],
    twist: fill(kit.sheet.twist, R),
    protagonist: { name: R.P.name, ...kit.sheet.protagonist },
    endingDevice: format === "impossible_choice" ? "impossible_decision" : kit.sheet.endingDevice,
  };
  return { format, sheet, episode: 1, title: kit.title, premise: kit.sheet.premise, hook: scenes[0].narration, ending: scenes[scenes.length - 1].narration, musicMood: kit.mood, cast: [R.P, R.F, R.A, R.S], scenes };
}

/* ---------------- Generic framework story ---------------- */

const DESIRES: [string, string][] = [
  ["get my brother back", "he's the only family I have left"],
  ["prove my dad was innocent", "everyone in town thinks he broke the rule"],
  ["get out of this town", "I'm running out of time to leave"],
  ["keep my best friend safe", "she has already broken the rule once"],
];

const TWISTS: Record<TwistType, string> = {
  identity: "{S} wasn't a stranger. {S} was the first person ever to break the rule. And {S} is family.",
  rule_reversal: "The rule wasn't keeping us safe from the world outside. It was keeping the world safe from us.",
  betrayal: "{A} wasn't enforcing the rule. {A} was choosing who broke it.",
  consequence: "I broke the rule to save {F}. It worked. But the rule was holding something back. And now it's loose.",
  perspective: "We thought the rule kept us trapped in here. It was the only thing keeping everyone else out.",
  loop: "The voice warning me all along was mine. From the night all of this ends.",
};

const CLIFF: Record<EndingDevice, { line: string; choice?: [string, string] }> = {
  impossible_decision: { line: "Two doors opened at the same time. One leads to {F}. One leads home.", choice: ["Find {F}", "Go home"] },
  new_revelation: { line: "Then I realised the rule started the day I was born." },
  unexpected_arrival: { line: "Then someone knocked on my window. It was me." },
  new_danger: { line: "And tonight, the rule is changing. Nobody knows what to." },
  missing_information: { line: "But I still don't know who wrote the first rule." },
  time_pressure: { line: "Whatever happens, it happens at midnight. I have six minutes." },
};

const CONTINUATIONS = [
  "Then my phone buzzed. A message from {F}: don't trust {A}.",
  "And {A} was standing right behind me. Smiling.",
  "The next morning, the rule had a new line. With my name in it.",
  "But the letter in my pocket had already started rewriting itself.",
];

function themeProps(themes: Theme[]): PropKind[] {
  if (themes.includes("money")) return ["falling_money"];
  if (themes.includes("dream")) return ["dream_screen"];
  if (themes.includes("truth")) return ["question_marks"];
  if (themes.includes("discover")) return ["sparkles"];
  return [];
}

function generic(opts: { prompt: string; duration: DurationPreset; R: Roles; r: ReturnType<typeof rng>; format: StoryFormat; themes: Theme[]; previous?: StoryPlan }): StoryPlan {
  const { R, r, themes, prompt, format, previous } = opts;
  const rule = ruleClause(previous?.sheet?.premise ?? prompt);
  const prevP = previous?.sheet?.protagonist;
  // Continuations keep the protagonist's original stakes.
  const [desire, vuln] = prevP
    ? [prevP.desire.replace(/^to\s+/i, "").replace(/\.$/, ""), prevP.vulnerability.replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase())]
    : r.pick(DESIRES);
  const twistType = r.pick(TWIST_TYPES.filter((t) => t !== previous?.sheet?.twistType));
  const endingDevice: EndingDevice = format === "impossible_choice" ? "impossible_decision" : r.pick(ENDING_DEVICES.filter((d) => d !== "impossible_decision"));
  const endingType = format === "strange_world" && !previous && r.next() < 0.4 ? "closed_loop" : "open_loop";
  const env: EnvironmentKind[] = themes.includes("dream")
    ? ["bedroom", "town_street", "school_hall"]
    : themes.includes("money")
      ? ["city_plaza", "store", "office"]
      : r.shuffle(["town_street", "school_hall", "city_plaza", "park", "forest"] as EnvironmentKind[]);
  const tp = themeProps(themes);
  const numbers = themes.includes("numbers");
  const grow = themes.includes("grow");

  const lines: Record<Beat, string> = {
    hook: previous ? `Last time: ${previous.sheet?.continuation ?? previous.ending}` : cleanPrompt(prompt),
    rule: previous
      ? `You know the rule. ${previous.sheet?.premise ?? ""}`.trim()
      : r.pick(["Nobody questions it. {A} says it keeps us safe.", "Everyone follows the rule. The ones who don't are never quite the same.", "There's one thing everyone here agrees on. You don't break the rule."]),
    character: previous ? `All I ever wanted was to ${desire}. And ${vuln}.` : `My name is {P}. All I want is to ${desire}. Because ${vuln}.`,
    escalation_1: r.pick(["Then it started happening to people on my street. {F} first.", "It started small. One house. Then the next."]),
    escalation_2: r.pick(["Last night, it happened to me.", "This morning, it was my turn."]),
    escalation_3: r.pick(["But when I checked the cameras, the person breaking the rule was me.", "And the town records said it had happened to me before. Three times."]),
    discovery: r.pick(["Then I found a letter in {S}'s coat. It had my name on it. And a date from before I was born.", "{S} kept a box of photos. Everyone who ever broke the rule. The last one was me. Dated tomorrow."]),
    twist: TWISTS[twistType],
    cliffhanger: endingType === "closed_loop" ? "So I fixed it. Everything went back to normal." : CLIFF[endingDevice].line,
    continuation: endingType === "closed_loop" ? "But the next morning, the sun didn't come up." : r.pick(CONTINUATIONS),
  };

  const castFor = (b: Beat): KitScene["cast"] => {
    switch (b) {
      case "hook": return [{ who: "P", action: "wave", expression: "neutral", label: numbers ? "7" : undefined }];
      case "rule": return [{ who: "A", action: "point", expression: "angry", label: numbers ? "999" : undefined }];
      case "character": return [{ who: "P", action: "sad", expression: "sad" }, { who: "F", action: "idle", expression: "happy" }];
      case "escalation_1": return [{ who: "F", action: "shocked", expression: "shocked", fading: !grow && !numbers }, { who: "P", action: "idle", expression: "shocked" }];
      case "escalation_2": return [{ who: "P", action: grow ? "grow" : "shocked", expression: "shocked", label: numbers ? "0" : undefined }];
      case "escalation_3": return [{ who: "P", action: "look_up", expression: "shocked" }, { who: "A", action: "idle", expression: "smug" }];
      case "discovery": return [{ who: "S", action: "give", expression: "neutral" }, { who: "P", action: "shocked", expression: "shocked" }];
      case "twist": return [{ who: twistType === "identity" ? "S" : twistType === "betrayal" ? "A" : "P", action: twistType === "betrayal" ? "point" : "look_up", expression: twistType === "betrayal" ? "smug" : "shocked" }];
      case "cliffhanger": return [{ who: "P", action: "shocked", expression: "shocked" }];
      default: return [{ who: "P", action: "idle", expression: "shocked" }];
    }
  };
  const propsFor = (b: Beat): PropKind[] => {
    if (b === "hook") return tp;
    if (b === "rule") return ["sign", ...tp];
    if (b === "escalation_1") return ["crowd"];
    if (b === "escalation_2") return ["flicker_lights", ...tp];
    if (b === "escalation_3") return ["fog"];
    if (b === "discovery") return [r.pick(["letter", "photo"] as PropKind[])];
    if (b === "twist") return ["sparkles"];
    if (b === "cliffhanger") return endingDevice === "unexpected_arrival" || endingDevice === "impossible_decision" ? ["open_door"] : ["fog"];
    return [];
  };
  const sfxFor: Partial<Record<Beat, KitScene["sfx"]>> = {
    hook: ["whoosh"], escalation_2: ["heartbeat"], escalation_3: ["glitch"], twist: ["impact"],
    cliffhanger: endingDevice === "unexpected_arrival" ? ["knock"] : endingDevice === "time_pressure" ? ["alarm"] : ["door_creak"], continuation: ["heartbeat"],
  };
  const timeFor = (b: Beat): TimeOfDay => (SHOT_FOR[b] === "suspense" || b === "twist" || b === "continuation" ? "night" : b === "discovery" ? "sunset" : "day");
  const envFor = (b: Beat, i: number): EnvironmentKind => (b === "discovery" ? (env.includes("office") ? "office" : "bedroom") : env[i % env.length]);

  const beats = [...BEATS_FOR[opts.duration]];
  if (opts.duration === 30 && format === "mystery_series") beats[beats.length - 1] = "continuation";
  const scenes = beats.map((b, i) =>
    sceneFrom(
      {
        beat: b, line: lines[b], env: envFor(b, i), time: timeFor(b), props: propsFor(b), sfx: sfxFor[b], cast: castFor(b),
        propText: b === "rule" ? rule.split(" ").slice(0, 5).join(" ").toUpperCase() : undefined,
        choice:
          b === "cliffhanger" && CLIFF[endingDevice].choice && endingType === "open_loop"
            ? { question: "Which door do I open?", options: CLIFF[endingDevice].choice!.map((o) => fill(o, R)) as [string, string] }
            : undefined,
        dialogue: b === "rule" ? { who: "A", line: "Rules are rules." } : b === "escalation_1" ? { who: "F", line: "I'm fine. I promise." } : undefined,
      },
      R, r, env[0],
    ),
  );
  if (opts.duration === 90) {
    const extra = (after: Beat, line: string, c: KitScene["cast"]) => {
      const i = scenes.findIndex((s) => s.beat === after);
      scenes.splice(i + 1, 0, sceneFrom({ beat: after, line, env: scenes[i].environment, time: scenes[i].timeOfDay, cast: c }, R, r, env[0]));
    };
    extra("character", "Everyone says I worry too much. They haven't seen what I've seen.", [{ who: "P", action: "shrug", expression: "sad" }]);
    extra("escalation_2", "Nobody else noticed. Or they were pretending not to.", [{ who: "P", action: "walk_across", expression: "shocked" }]);
    extra("discovery", "Whoever wrote it knew exactly where I'd be standing when I read it.", [{ who: "P", action: "look_up", expression: "shocked" }]);
  }
  if (grow) {
    let s = 1;
    for (const sc of scenes) if (sc.beat?.startsWith("escalation")) for (const c of sc.characters) if (c.ref === R.P.ref) c.scaleTo = s = Math.min(2.2, s + 0.35);
  }

  const sheet: StorySheet = {
    premise: cleanPrompt(previous?.sheet?.premise ?? prompt),
    rule: previous?.sheet?.rule ?? `Everyone lives by it: ${rule}.`,
    whyObey: previous?.sheet?.whyObey ?? `${R.A.name} says it keeps everyone safe.`,
    breakConsequence: previous?.sheet?.breakConsequence ?? "People who break it are never quite the same again.",
    beneficiary: previous?.sheet?.beneficiary ?? `${R.A.name}, who enforces it.`,
    secret: fill(TWISTS[twistType], R),
    protagonist: { name: R.P.name, desire: `To ${desire}.`, vulnerability: vuln.charAt(0).toUpperCase() + vuln.slice(1) + ".", secret: prevP?.secret ?? "I've seen it happen before." },
    conflict: fill(lines.escalation_1, R),
    escalation: [fill(lines.escalation_1, R), fill(lines.escalation_2, R), fill(lines.escalation_3, R)],
    mystery: fill(lines.discovery, R),
    twistType,
    twist: fill(lines.twist, R),
    endingType,
    endingDevice,
    ending: fill(lines.cliffhanger, R),
    continuation: fill(lines.continuation, R),
  };
  const episode = (previous?.episode ?? 0) + 1;
  const baseTitle = previous ? previous.title.replace(/ · Part \d+$/, "") : titleFrom(prompt);
  const mood: MusicMood = endingType === "closed_loop" ? "mysterious" : r.pick(["mysterious", "tense"] as const);
  return {
    format, sheet, episode, title: episode > 1 ? `${baseTitle} · Part ${episode}` : baseTitle, premise: sheet.premise,
    hook: scenes[0].narration, ending: scenes[scenes.length - 1].narration, musicMood: mood, cast: [R.P, R.F, R.A, R.S], scenes,
  };
}

export function generateDevStory(opts: {
  prompt: string;
  duration: DurationPreset;
  /** Characters the user chose to cast. The first becomes the protagonist. */
  cast: CharacterRecord[];
  seed?: string;
  format?: StoryFormat;
  /** Previous episode, for series continuations. */
  previous?: StoryPlan;
}): StoryPlan {
  const format = opts.format ?? "strange_world";
  const r = rng(hashString((opts.seed ?? "") + opts.prompt + opts.duration + format));
  const R = castRoles(opts.cast, r);
  if (opts.previous) {
    // Same cast across episodes.
    for (const [k, ref] of [["P", "c1"], ["F", "c2"], ["A", "c3"], ["S", "c4"]] as const) {
      const m = opts.previous.cast.find((c) => c.ref === ref);
      if (m) R[k] = { ...m };
    }
  }
  const kit = opts.previous ? undefined : KITS.find((k) => k.match.test(opts.prompt));
  if (kit) return fromKit(kit, opts.duration, R, r, format);
  return generic({ prompt: opts.prompt, duration: opts.duration, R, r, format, themes: detectThemes(opts.prompt), previous: opts.previous });
}

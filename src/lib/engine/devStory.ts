/**
 * Development story engine.
 *
 * A deterministic, template-based story writer used when no LLM provider is
 * configured. It is NOT AI: it detects a few themes in the prompt and fills a
 * short-form story arc (hook → setup → escalation → twist → ending) from
 * hand-written beat pools. The UI labels output from this engine as such.
 */
import type { CharacterRecord } from "./characters";
import { OFFICIAL_CHARACTERS } from "./characters";
import { hashString, rng } from "./rng";
import type {
  Action,
  CastMember,
  DurationPreset,
  EnvironmentKind,
  MusicMood,
  PropKind,
  ScenePlan,
  SfxKind,
  StoryPlan,
  TimeOfDay,
} from "./types";

type Theme = "money" | "grow" | "numbers" | "dream" | "truth" | "silence" | "discover" | "jump" | "kind" | "generic";

const THEME_TESTS: [Theme, RegExp][] = [
  ["dream", /\bdream|asleep|sleep|bed\b|nightmare/i],
  ["numbers", /\bnumber|score|count|level|rating/i],
  ["grow", /\btall|grow|bigger|giant|shrink|tiny|small/i],
  ["money", /\bmoney|rich|coin|cash|dollar|pay|price|cost|gold|tree/i],
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

function titleFrom(prompt: string, themes: Theme[]) {
  const stripped = prompt
    .replace(/^(in my world|imagine if|nobody knows that|what if everyone|what if|one day,? i woke up( and)?|pov:? you discover)[,:]?\s*/i, "")
    .replace(/[.!?…]+$/, "")
    .trim();
  const words = stripped.split(" ").filter(Boolean);
  if (words.length > 0 && words.length <= 6) return words.join(" ").replace(/^\w/, (c) => c.toUpperCase());
  const byTheme: Record<Theme, string> = {
    money: "The Money Rule",
    grow: "Growing Up, Literally",
    numbers: "The Number Above Your Head",
    dream: "Dream Screen",
    truth: "No More Lies",
    silence: "The Quiet Town",
    discover: "The Hidden Door",
    jump: "Every Jump Counts",
    kind: "Kindness Pays",
    generic: "My World",
  };
  return byTheme[themes[0]];
}

interface Ctx {
  hero: CastMember;
  friend: CastMember;
  rival: CastMember;
  themes: Theme[];
  prompt: string;
  r: ReturnType<typeof rng>;
  heroScale: number;
  heroNumber: number;
  env: EnvironmentKind[];
  time: TimeOfDay;
}

type Beat = (c: Ctx) => ScenePlan;

const has = (c: Ctx, t: Theme) => c.themes.includes(t);

function sceneBase(c: Ctx, partial: Partial<ScenePlan> & Pick<ScenePlan, "narration" | "description">): ScenePlan {
  return {
    environment: partial.environment ?? c.env[0],
    timeOfDay: partial.timeOfDay ?? c.time,
    camera: partial.camera ?? "medium",
    characters: partial.characters ?? [],
    props: partial.props ?? [],
    sfx: partial.sfx ?? [],
    ...partial,
  };
}

function themeProps(c: Ctx): PropKind[] {
  if (has(c, "money")) return c.prompt.match(/tree/i) ? ["money_tree"] : ["falling_money"];
  if (has(c, "dream")) return ["dream_screen"];
  if (has(c, "truth")) return ["question_marks"];
  if (has(c, "kind")) return ["hearts"];
  if (has(c, "discover")) return ["sparkles"];
  return [];
}

function themeSfx(c: Ctx): SfxKind[] {
  if (has(c, "money")) return ["coins"];
  if (has(c, "grow")) return ["boing"];
  if (has(c, "dream")) return ["magic"];
  if (has(c, "numbers")) return ["ding"];
  if (has(c, "jump")) return ["boing"];
  return ["pop"];
}

function themeAction(c: Ctx): Action {
  if (has(c, "grow")) return "grow";
  if (has(c, "jump")) return "jump";
  if (has(c, "kind")) return "give";
  if (has(c, "money")) return "celebrate";
  if (has(c, "dream")) return "look_up";
  return "point";
}

function label(c: Ctx, who: "hero" | "friend" | "rival"): string | undefined {
  if (!has(c, "numbers")) return undefined;
  if (who === "hero") return String(c.heroNumber);
  if (who === "friend") return "42";
  return "999";
}

const HOOK: Beat = (c) =>
  sceneBase(c, {
    narration: cleanPrompt(c.prompt),
    description: `${c.hero.name} stands in the middle of the world, looking straight at us.`,
    camera: "dolly_in",
    characters: [{ ref: c.hero.ref, action: "wave", position: "center", expression: "happy", label: label(c, "hero") }],
    props: themeProps(c),
    sfx: ["whoosh"],
    propText: has(c, "dream") ? "ZZZ…" : undefined,
  });

const SETUP: Beat[] = [
  (c) =>
    sceneBase(c, {
      narration: `Here, that's completely normal. Nobody even questions it anymore. Except ${c.hero.name}.`,
      description: `People pass by as ${c.hero.name} watches, unconvinced.`,
      camera: "wide",
      environment: c.env[1],
      characters: [
        { ref: c.friend.ref, action: "walk_across", position: "back_left", expression: "neutral", label: label(c, "friend") },
        { ref: c.hero.ref, action: "shrug", position: "center", expression: "smug", label: label(c, "hero") },
      ],
      props: has(c, "money") ? ["money_tree"] : themeProps(c),
      sfx: ["pop"],
    }),
  (c) =>
    sceneBase(c, {
      narration: `My best friend ${c.friend.name} says the rule is the only thing that keeps this place fair.`,
      description: `${c.friend.name} explains the rule with big hand gestures.`,
      camera: "over_shoulder",
      environment: c.env[1],
      characters: [
        { ref: c.friend.ref, action: "talk", position: "left", expression: "happy", label: label(c, "friend") },
        { ref: c.hero.ref, action: "idle", position: "right", expression: "neutral", label: label(c, "hero") },
      ],
      dialogue: { ref: c.friend.ref, line: "Trust me. It's fair." },
      sfx: ["pop"],
    }),
];

const DEMO: Beat[] = [
  (c) => {
    c.heroScale = Math.min(1.9, c.heroScale + 0.25);
    c.heroNumber += 13;
    return sceneBase(c, {
      narration: `So the first time it happened to me, I didn't believe it. Then it happened again.`,
      description: `The rule visibly kicks in on ${c.hero.name}.`,
      camera: "low_angle",
      environment: c.env[2],
      characters: [
        { ref: c.hero.ref, action: themeAction(c), position: "center", expression: "shocked", label: label(c, "hero"), scaleTo: has(c, "grow") ? c.heroScale : undefined },
      ],
      props: [...themeProps(c), "sparkles"],
      sfx: themeSfx(c),
    });
  },
  (c) => {
    c.heroScale = Math.min(1.9, c.heroScale + 0.2);
    c.heroNumber += 21;
    return sceneBase(c, {
      narration: `By lunchtime the whole street was watching. ${c.friend.name} couldn't stop laughing.`,
      description: `${c.friend.name} doubles over laughing as a crowd gathers.`,
      camera: "orbit",
      environment: c.env[2],
      characters: [
        { ref: c.hero.ref, action: themeAction(c), position: "center", expression: "happy", label: label(c, "hero"), scaleTo: has(c, "grow") ? c.heroScale : undefined },
        { ref: c.friend.ref, action: "celebrate", position: "left", expression: "happy", label: label(c, "friend") },
      ],
      props: ["crowd", ...themeProps(c)],
      sfx: ["cheer", ...themeSfx(c)],
    });
  },
  (c) =>
    sceneBase(c, {
      narration: has(c, "dream")
        ? `Every night the screen showed what I really wanted. And every morning, the neighbours had already seen it.`
        : `Everyone had a strategy. Mine was simple: do it more than anyone else.`,
      description: `${c.hero.name} gets to work, determined.`,
      camera: "pan",
      environment: has(c, "dream") ? "bedroom" : c.env[0],
      timeOfDay: has(c, "dream") ? "night" : c.time,
      characters: [{ ref: c.hero.ref, action: has(c, "dream") ? "sleep" : "run", position: "center", expression: "determined" as never, label: label(c, "hero") }],
      props: themeProps(c),
      propText: has(c, "dream") ? "A GIANT TROPHY" : undefined,
      sfx: ["whoosh"],
    }),
];

const COMPLICATION: Beat[] = [
  (c) =>
    sceneBase(c, {
      narration: `Then ${c.rival.name} showed up. ${c.rival.name} had figured out how to game the rule.`,
      description: `${c.rival.name} struts in, smug, and the music changes.`,
      camera: "low_angle",
      environment: "city_plaza",
      characters: [
        { ref: c.rival.ref, action: "walk_in_right", position: "right", expression: "smug", label: label(c, "rival"), scaleTo: has(c, "grow") ? 2.1 : undefined },
        { ref: c.hero.ref, action: "shocked", position: "left", expression: "shocked", label: label(c, "hero") },
      ],
      dialogue: { ref: c.rival.ref, line: "Rules are for beginners." },
      props: themeProps(c),
      sfx: ["record_scratch"],
    }),
  (c) =>
    sceneBase(c, {
      narration: `Overnight, ${c.rival.name} was the most famous person in town. And I was nobody.`,
      description: `${c.rival.name} celebrates on a stage while ${c.hero.name} sulks.`,
      camera: "wide",
      environment: "stage",
      timeOfDay: "night",
      characters: [
        { ref: c.rival.ref, action: "dance", position: "center", expression: "smug", label: label(c, "rival") },
        { ref: c.hero.ref, action: "sad", position: "back_left", expression: "sad", label: label(c, "hero") },
      ],
      props: ["confetti", "crowd"],
      sfx: ["cheer"],
    }),
];

const ESCALATION: Beat[] = [
  (c) =>
    sceneBase(c, {
      narration: `So I tried harder. Way harder. It got ridiculous.`,
      description: `${c.hero.name} attempts the rule over and over in a quick montage.`,
      camera: "dolly_in",
      environment: c.env[3],
      characters: [{ ref: c.hero.ref, action: has(c, "jump") ? "jump" : "run", position: "center", expression: "determined" as never, label: label(c, "hero") }],
      props: themeProps(c),
      sfx: ["drumroll"],
    }),
  (c) =>
    sceneBase(c, {
      narration: `${c.friend.name} tried to warn me. I didn't listen.`,
      description: `${c.friend.name} grabs ${c.hero.name}'s arm, pleading.`,
      camera: "over_shoulder",
      environment: c.env[3],
      characters: [
        { ref: c.friend.ref, action: "talk", position: "left", expression: "sad", label: label(c, "friend") },
        { ref: c.hero.ref, action: "idle", position: "right", expression: "angry", label: label(c, "hero") },
      ],
      dialogue: { ref: c.friend.ref, line: "This isn't you." },
      sfx: ["heartbeat"],
    }),
  (c) =>
    sceneBase(c, {
      narration: `And then the whole town found out what the rule actually costs.`,
      description: `Alarms, chaos — everyone stops and looks up.`,
      camera: "top_down",
      environment: "town_street",
      characters: [
        { ref: c.hero.ref, action: "look_up", position: "center", expression: "shocked", label: label(c, "hero") },
        { ref: c.rival.ref, action: "shocked", position: "right", expression: "shocked", label: label(c, "rival") },
        { ref: c.friend.ref, action: "shocked", position: "left", expression: "shocked", label: label(c, "friend") },
      ],
      props: ["rain", "question_marks"],
      timeOfDay: "sunset",
      sfx: ["alarm"],
    }),
];

const TWIST: Beat[] = [
  (c) =>
    sceneBase(c, {
      narration: `Turns out ${c.rival.name} was faking it the whole time. The rule only works if you mean it.`,
      description: `${c.rival.name}'s act falls apart in front of everyone.`,
      camera: "close_up",
      environment: "city_plaza",
      characters: [
        { ref: c.rival.ref, action: "sad", position: "center", expression: "sad", label: has(c, "numbers") ? "0" : undefined, scaleTo: has(c, "grow") ? 0.9 : undefined },
      ],
      props: ["question_marks"],
      sfx: ["thud"],
    }),
  (c) =>
    sceneBase(c, {
      narration: `So I stopped trying to win. I just did the thing for ${c.friend.name}. Once. For real.`,
      description: `${c.hero.name} quietly helps ${c.friend.name}.`,
      camera: "medium",
      environment: "park",
      timeOfDay: "sunset",
      characters: [
        { ref: c.hero.ref, action: "give", position: "left", expression: "happy", label: label(c, "hero") },
        { ref: c.friend.ref, action: "celebrate", position: "right", expression: "happy", label: label(c, "friend") },
      ],
      props: ["gift_box", "hearts"],
      sfx: ["magic"],
    }),
];

const ENDING: Beat[] = [
  (c) => {
    c.heroScale = Math.min(2.4, c.heroScale + 0.5);
    c.heroNumber = 1000;
    return sceneBase(c, {
      narration: `And that one time counted more than everything else combined. Anyway. That's my world. What's yours?`,
      description: `${c.hero.name} and ${c.friend.name} celebrate as confetti falls.`,
      camera: "orbit",
      environment: "park",
      timeOfDay: "sunset",
      characters: [
        { ref: c.hero.ref, action: "celebrate", position: "center", expression: "happy", label: label(c, "hero"), scaleTo: has(c, "grow") ? c.heroScale : undefined },
        { ref: c.friend.ref, action: "dance", position: "left", expression: "happy", label: label(c, "friend") },
      ],
      props: ["confetti", ...themeProps(c)],
      sfx: ["cheer"],
    });
  },
];

const ARC_BY_DURATION: Record<DurationPreset, (Beat | Beat[])[]> = {
  30: [HOOK, SETUP, DEMO, COMPLICATION, ENDING],
  60: [HOOK, SETUP, DEMO, DEMO, COMPLICATION, ESCALATION, TWIST, ENDING],
  90: [HOOK, SETUP, SETUP, DEMO, DEMO, DEMO, COMPLICATION, COMPLICATION, ESCALATION, ESCALATION, TWIST, TWIST, ENDING],
};

const MOOD: Record<Theme, MusicMood> = {
  money: "epic",
  grow: "playful",
  numbers: "mysterious",
  dream: "chill",
  truth: "playful",
  silence: "mysterious",
  discover: "mysterious",
  jump: "playful",
  kind: "chill",
  generic: "playful",
};

function castFrom(rec: CharacterRecord, ref: string, role: string): CastMember {
  return { ref, name: rec.name, role, characterId: rec.id };
}

export function generateDevStory(opts: {
  prompt: string;
  duration: DurationPreset;
  /** Characters the user chose to cast. The first becomes the hero. */
  cast: CharacterRecord[];
  seed?: string;
}): StoryPlan {
  const themes = detectThemes(opts.prompt);
  const r = rng(hashString((opts.seed ?? "") + opts.prompt + opts.duration));
  const pool = r.shuffle(OFFICIAL_CHARACTERS.filter((c) => c.reusePolicy === "anyone"));
  const chosen = [...opts.cast];
  for (const c of pool) {
    if (chosen.length >= 3) break;
    if (!chosen.some((x) => x.id === c.id)) chosen.push(c);
  }
  const hero = castFrom(chosen[0], "c1", "Narrator and hero");
  const friend = castFrom(chosen[1], "c2", "Best friend");
  const rival = castFrom(chosen[2], "c3", "Rival");

  const envs: EnvironmentKind[] = has0(themes, "dream")
    ? ["bedroom", "town_street", "school_hall", "park"]
    : has0(themes, "money")
      ? ["city_plaza", "park", "town_street", "office"]
      : has0(themes, "discover")
        ? ["town_street", "forest", "forest", "school_hall"]
        : r.shuffle(["town_street", "park", "school_hall", "city_plaza", "beach"] as EnvironmentKind[]);

  const ctx: Ctx = {
    hero, friend, rival, themes, prompt: opts.prompt, r,
    heroScale: 1, heroNumber: 7, env: envs,
    time: has0(themes, "dream") ? "night" : "day",
  };

  const used = new Set<Beat>();
  const scenes = ARC_BY_DURATION[opts.duration].map((slot) => {
    if (typeof slot === "function") return slot(ctx);
    const options = slot.filter((b) => !used.has(b));
    const beat = options.length ? options[0] : slot[0];
    used.add(beat);
    return beat(ctx);
  });

  // Normalise any non-vocabulary expression we used for flavour.
  for (const s of scenes) for (const ch of s.characters) if ((ch.expression as string) === "determined") ch.expression = "neutral";

  return {
    title: titleFrom(opts.prompt, themes),
    premise: cleanPrompt(opts.prompt),
    hook: scenes[0].narration,
    ending: scenes[scenes.length - 1].narration,
    musicMood: MOOD[themes[0]],
    cast: [hero, friend, rival],
    scenes,
  };
}

function has0(themes: Theme[], t: Theme) {
  return themes.includes(t);
}

/**
 * The studio's editorial checklist, checked structurally. These checks can
 * prove a story has the right *shape* (a rule, stakes, escalation, a twist,
 * pacing, visual variety, sound cues, an ending device). Whether the twist is
 * actually surprising, or the premise original, needs an editor — the AI
 * editor pass when Claude is configured, a human otherwise. Those items are
 * left as `null` here rather than guessed.
 */
import type { ChecklistItem, StoryPlan } from "./types";

export const CHECKLIST: { key: string; label: string }[] = [
  { key: "premise", label: "Starts with an interesting premise" },
  { key: "rule", label: "The world has a clear, understandable rule" },
  { key: "stakes", label: "The protagonist has something meaningful to lose" },
  { key: "escalation", label: "The conflict escalates rather than repeats" },
  { key: "twist", label: "The twist changes the audience's understanding" },
  { key: "narration", label: "Narration sounds natural and conversational" },
  { key: "visuals", label: "Visuals show what the narration cannot" },
  { key: "sound", label: "Sound design reinforces the emotional progression" },
  { key: "ending", label: "The ending resolves something or opens a real question" },
  { key: "original", label: "Feels original, not a reskinned viral video" },
];

const SHOW_DONT_TELL = new Set(["abandoned_shoes", "open_door", "letter", "photo", "fog", "flicker_lights", "moon", "traffic_light", "sign", "dream_screen"]);

function sentences(text: string) {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function checkStory(plan: StoryPlan): ChecklistItem[] {
  const sheet = plan.sheet;
  const scenes = plan.scenes;
  const beats = scenes.map((s) => s.beat);
  const narr = scenes.map((s) => s.narration);
  const allSentences = narr.flatMap(sentences);
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const avg = allSentences.reduce((a, s) => a + words(s), 0) / Math.max(1, allSentences.length);
  const longest = Math.max(0, ...allSentences.map(words));
  const shots = new Set(scenes.map((s) => s.shot).filter(Boolean));
  const sdt = scenes.filter((s) => s.props.some((p) => SHOW_DONT_TELL.has(p)) || s.characters.some((c) => c.noShadow || c.fading)).length;
  const escalations = scenes.filter((s) => s.beat?.startsWith("escalation")).length;
  const dupes = narr.length - new Set(narr).size;
  const twist = scenes.find((s) => s.beat === "twist");
  const last = scenes.at(-1);

  const r = (key: string, pass: boolean | null, note: string): ChecklistItem => ({ key, label: CHECKLIST.find((c) => c.key === key)!.label, pass, note });
  return [
    r("premise", scenes[0]?.beat === "hook" && words(scenes[0].narration) <= 22 ? true : false, scenes[0]?.beat === "hook" ? `Hook: “${scenes[0].narration}”` : "The first scene isn't a hook."),
    r("rule", !!sheet?.rule && beats.includes("rule"), sheet?.rule ? `Rule: ${sheet.rule}` : "No rule defined."),
    r("stakes", !!sheet?.protagonist.desire && !!sheet?.protagonist.vulnerability, sheet ? `Wants: ${sheet.protagonist.desire} Risks: ${sheet.protagonist.vulnerability}` : "No protagonist stakes defined."),
    r("escalation", escalations >= 1 && dupes === 0, dupes ? `${dupes} repeated line(s).` : `${escalations} escalation scene(s), no repeated lines.`),
    r("twist", twist && sheet?.twistType ? null : false, twist && sheet?.twistType ? `${sheet.twistType.replace(/_/g, " ")} twist present — whether it surprises needs an editor.` : "No twist scene."),
    r("narration", avg <= 14 && longest <= 24, `Average sentence ${avg.toFixed(1)} words, longest ${longest}.`),
    r("visuals", shots.size >= 3 && sdt >= 1, `${shots.size} shot types, ${sdt} show-don't-tell scene(s).`),
    r("sound", !!twist?.pauseBefore && !!twist?.sfx.length, twist?.pauseBefore ? "Silence before the twist, then an impact." : "No pause or impact on the twist."),
    r("ending", !!sheet?.endingDevice && (last?.beat === "cliffhanger" || last?.beat === "continuation"), sheet ? `${sheet.endingType === "open_loop" ? "Open" : "Closed"} loop · ${sheet.endingDevice.replace(/_/g, " ")}.` : "No ending device."),
    r("original", null, "Needs an editor's judgement."),
  ];
}

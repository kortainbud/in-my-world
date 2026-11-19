/**
 * Kokoro voices (Apache-2.0, https://huggingface.co/hexgrad/Kokoro-82M),
 * synthesized in the viewer's browser. Shared by server and client.
 */
export interface KokoroVoice {
  id: string;
  label: string;
  accent: "American" | "British";
}

/** Narrators offered in the Create screen (the higher-graded voices). */
export const KOKORO_NARRATORS: KokoroVoice[] = [
  { id: "af_heart", label: "Heart", accent: "American" },
  { id: "am_michael", label: "Michael", accent: "American" },
  { id: "af_bella", label: "Bella", accent: "American" },
  { id: "am_puck", label: "Puck", accent: "American" },
  { id: "bf_emma", label: "Emma", accent: "British" },
  { id: "bm_george", label: "George", accent: "British" },
];

const ALL = new Set([
  "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
  "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck",
  "bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
]);

/** Character voices were first named after macOS voices; map them to Kokoro. */
const FROM_SAY: Record<string, string> = {
  "Eddy (English (US))": "am_michael",
  "Flo (English (US))": "af_bella",
  Ralph: "am_fenrir",
  Junior: "am_puck",
  Moira: "bf_emma",
  "Reed (English (US))": "am_eric",
  Kathy: "af_nicole",
  "Flo (English (UK))": "bf_isabella",
  Daniel: "bm_george",
  Fred: "am_adam",
  Samantha: "af_heart",
  Karen: "af_sarah",
};
const FALLBACK = ["am_michael", "af_bella", "am_puck", "af_nicole", "bm_george", "bf_emma", "am_fenrir", "af_sarah"];

export function kokoroVoiceFor(voice: string | undefined | null, seed = ""): string {
  if (voice && ALL.has(voice)) return voice;
  if (voice && FROM_SAY[voice]) return FROM_SAY[voice];
  let h = 0;
  for (const c of (voice ?? "") + seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return FALLBACK[Math.abs(h) % FALLBACK.length];
}

/** Speaking speed by delivery: quicker for action, slower before revelations. */
export const KOKORO_SPEED: Record<string, number> = { fast: 1.1, normal: 1, slow: 0.88 };

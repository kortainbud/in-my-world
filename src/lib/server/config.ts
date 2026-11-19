import "server-only";
import path from "node:path";

/**
 * Runtime mode and provider selection.
 *
 * development — dev providers (template story engine, macOS `say` voice,
 *   in-browser renderer) are allowed and clearly labelled in the UI.
 * production — only real providers. If one isn't configured, generation
 *   fails with a clear error instead of silently falling back.
 */
export type Mode = "development" | "production";

export const MODE: Mode = process.env.IMW_MODE === "production" ? "production" : "development";
export const DATA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || ".data");

export type StoryProviderId = "anthropic" | "dev-template";
export type VoiceProviderId = "kokoro-browser" | "macos-say" | "none";
export type RenderProviderId = "browser";

/**
 * Production can opt in to the template story engine (labelled "not AI" in
 * the UI) with ALLOW_TEMPLATE_STORIES=true, so videos work before an
 * Anthropic key is added.
 */
const TEMPLATE_OK = MODE === "development" || process.env.ALLOW_TEMPLATE_STORIES === "true";

function storyProvider(): StoryProviderId | null {
  const explicit = process.env.STORY_PROVIDER as StoryProviderId | undefined;
  if (explicit === "anthropic") return "anthropic";
  if (explicit === "dev-template") return TEMPLATE_OK ? "dev-template" : null;
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  return TEMPLATE_OK ? "dev-template" : null;
}

/**
 * Narration defaults to Kokoro, recorded in the viewer's browser just before
 * the video renders (free, no server). VOICE_PROVIDER=macos-say uses the Mac's
 * system voices in development; none turns narration off.
 */
function voiceProvider(): VoiceProviderId {
  const explicit = process.env.VOICE_PROVIDER as VoiceProviderId | undefined;
  if (explicit === "none") return "none";
  if (explicit === "macos-say" && MODE === "development" && process.platform === "darwin") return "macos-say";
  return "kokoro-browser";
}

export const PROVIDERS = {
  story: storyProvider(),
  voice: voiceProvider(),
  /**
   * The browser render agent encodes MP4s on the user's device with WebCodecs.
   * A server-side render farm (Remotion/Blender) would be a second provider.
   */
  render: "browser" as RenderProviderId,
};

export const STORY_MODEL = process.env.STORY_MODEL || "claude-opus-5-5";

export function providerSummary() {
  return {
    mode: MODE,
    story: PROVIDERS.story
      ? { id: PROVIDERS.story, label: PROVIDERS.story === "anthropic" ? `Claude (${STORY_MODEL})` : "Template engine (not AI)", ai: PROVIDERS.story === "anthropic" }
      : { id: null, label: "Not configured", ai: false },
    voice: { id: PROVIDERS.voice, label: PROVIDERS.voice === "kokoro-browser" ? "Kokoro (recorded in your browser)" : PROVIDERS.voice === "macos-say" ? "macOS system voices (dev only)" : "No narration provider" },
    render: { id: PROVIDERS.render, label: "In-browser renderer (WebCodecs)" },
    payments: { card: !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET, crypto: !!process.env.SOLANA_RECEIVER_ADDRESS, configured: (!!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET) || !!process.env.SOLANA_RECEIVER_ADDRESS },
  };
}

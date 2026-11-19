import { createAccount, requireUser } from "@/lib/server/auth";
import { addCredits } from "@/lib/server/credits";
import { getDoc } from "@/lib/server/data";
import { requireDevMode, SAMPLE_PROMPTS } from "@/lib/server/dev";
import { json, route } from "@/lib/server/http";
import type { User } from "@/lib/server/models";
import { createGeneration, SAMPLE_USER_ID } from "@/lib/server/pipeline";
import { defaultNarrator } from "@/lib/server/providers/voice";

/**
 * Development only: queues the sample videos under a dedicated samples account.
 * The signed-in developer's browser renders them like any other job.
 */
export const POST = route(async (req: Request) => {
  const only = new URL(req.url).searchParams.get("only")?.toLowerCase();
  requireDevMode();
  await requireUser();
  const sampleUser = (await getDoc<User>("users", SAMPLE_USER_ID)) ?? (await createAccount({ id: SAMPLE_USER_ID, email: null, passwordHash: null, displayName: "In My World samples", planId: "pro" }));
  await addCredits(SAMPLE_USER_ID, 500, "dev_grant", "Sample generation");
  const queued: string[] = [];
  for (const s of SAMPLE_PROMPTS.filter((x) => !only || x.prompt.toLowerCase().includes(only))) {
    const { project } = await createGeneration(sampleUser, {
      prompt: s.prompt, style: s.style, format: s.format, duration: 30, castIds: [], voice: defaultNarrator(), exportOverride: 720, idempotencyKey: `sample:${s.style}:${s.prompt}:${Date.now()}`,
    });
    queued.push(project.id);
  }
  return json({ queued });
});

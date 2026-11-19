import { requireUser } from "@/lib/server/auth";
import { createAccount } from "@/lib/server/auth";
import { id, now, read, tx } from "@/lib/server/db";
import { requireDevMode, SAMPLE_PROMPTS } from "@/lib/server/dev";
import { json, route } from "@/lib/server/http";
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
  await tx((db) => {
    if (!db.users.some((u) => u.id === SAMPLE_USER_ID)) {
      const u = createAccount(db, { email: null, passwordHash: null, displayName: "In My World samples" });
      // Re-key the account to the well-known samples id.
      for (const coll of [db.profiles, db.subscriptions, db.credits] as { userId: string }[][]) for (const r of coll) if (r.userId === u.id) r.userId = SAMPLE_USER_ID;
      u.id = SAMPLE_USER_ID;
      const sub = db.subscriptions.find((s) => s.userId === SAMPLE_USER_ID)!;
      sub.planId = "pro";
    }
    db.credits.push({ id: id("ctx"), userId: SAMPLE_USER_ID, amount: 500, kind: "dev_grant", note: "Sample generation", createdAt: now() });
  });
  const sampleUser = await read((db) => db.users.find((u) => u.id === SAMPLE_USER_ID)!);
  const queued: string[] = [];
  for (const s of SAMPLE_PROMPTS.filter((x) => !only || x.prompt.toLowerCase().includes(only))) {
    const { project } = await createGeneration(sampleUser, {
      prompt: s.prompt, style: s.style, format: s.format, duration: 30, castIds: [], voice: defaultNarrator(), exportOverride: 720, idempotencyKey: `sample:${s.style}:${s.prompt}:${Date.now()}`,
    });
    queued.push(project.id);
  }
  return json({ queued });
});

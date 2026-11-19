import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { advanceJob } from "@/lib/server/pipeline";

export const maxDuration = 60;

/** Runs the server-side stages of a queued job. Called by the project page while it's open. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  return json(await advanceJob(id, user.id));
});

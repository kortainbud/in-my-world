import { requireUser } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { retryFailed } from "@/lib/server/pipeline";

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  await retryFailed(user, id);
  return json({ ok: true });
});

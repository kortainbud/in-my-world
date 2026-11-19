import { HttpError, requireUser } from "@/lib/server/auth";
import { countDocs, deleteDocs, getDoc } from "@/lib/server/data";
import { json, route } from "@/lib/server/http";
import type { Wallet } from "@/lib/server/models";

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const w = await getDoc<Wallet>("wallets", id);
  if (!w || w.userId !== user.id) throw new HttpError(404, "Wallet not found.");
  const others = await countDocs("wallets", (q) => q.eq("user_id", user.id).neq("id", id));
  if (!user.email && others === 0) throw new HttpError(409, "This wallet is how you sign in. Add an email and password before unlinking it.");
  await deleteDocs("wallets", (q) => q.eq("id", id).eq("user_id", user.id));
  return json({ ok: true });
});

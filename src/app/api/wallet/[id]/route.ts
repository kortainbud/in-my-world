import { HttpError, requireUser } from "@/lib/server/auth";
import { tx } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  await tx((db) => {
    const w = db.wallets.find((x) => x.id === id && x.userId === user.id);
    if (!w) throw new HttpError(404, "Wallet not found.");
    const u = db.users.find((x) => x.id === user.id)!;
    const others = db.wallets.filter((x) => x.userId === user.id && x.id !== id).length;
    if (!u.email && others === 0) throw new HttpError(409, "This wallet is how you sign in. Add an email and password before unlinking it.");
    db.wallets = db.wallets.filter((x) => x.id !== id);
  });
  return json({ ok: true });
});

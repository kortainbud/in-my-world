import { currentUser } from "@/lib/server/auth";
import { providerSummary } from "@/lib/server/config";
import { balanceOf, rollPeriods } from "@/lib/server/credits";
import { tx } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { narratorVoices } from "@/lib/server/providers/voice";
import { getPlan } from "@/config/plans";

export const GET = route(async () => {
  const user = await currentUser();
  const providers = providerSummary();
  if (!user) return json({ user: null, providers, voices: narratorVoices() });
  const data = await tx((db) => {
    const sub = rollPeriods(db, user.id);
    const profile = db.profiles.find((p) => p.userId === user.id)!;
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: profile.displayName,
        handle: profile.handle,
        planId: sub?.planId ?? "free",
        plan: getPlan(sub?.planId),
        balance: balanceOf(db, user.id),
        wallets: db.wallets.filter((w) => w.userId === user.id),
        hasPassword: !!user.passwordHash,
      },
    };
  });
  return json({ ...data, providers, voices: narratorVoices() });
});

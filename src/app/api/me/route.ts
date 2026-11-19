import { currentUser } from "@/lib/server/auth";
import { providerSummary } from "@/lib/server/config";
import { rollPeriods } from "@/lib/server/credits";
import { creditBalance, findDocs, getDoc } from "@/lib/server/data";
import { json, route } from "@/lib/server/http";
import type { Profile, Wallet } from "@/lib/server/models";
import { narratorVoices } from "@/lib/server/providers/voice";
import { getPlan } from "@/config/plans";

export const GET = route(async () => {
  const user = await currentUser();
  const providers = providerSummary();
  if (!user) return json({ user: null, providers, voices: narratorVoices() });
  const [sub, profile, wallets] = await Promise.all([
    rollPeriods(user.id),
    getDoc<Profile>("profiles", user.id),
    findDocs<Wallet>("wallets", (q) => q.eq("user_id", user.id)),
  ]);
  // After rollPeriods, so a new month's allowance is included.
  const balance = await creditBalance(user.id);
  return json({
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName ?? "Creator",
      handle: profile?.handle ?? "",
      planId: sub?.planId ?? "free",
      plan: getPlan(sub?.planId),
      balance,
      wallets,
      hasPassword: !!user.passwordHash,
    },
    providers,
    voices: narratorVoices(),
  });
});

import type { Metadata } from "next";
import { DraftNotice, Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <Prose title="Terms of service">
      <DraftNotice />
      <h2>What this will cover</h2>
      <ul>
        <li>Accounts, eligibility and acceptable use.</li>
        <li>Ownership of the videos you create and the licence we need to host and process them.</li>
        <li>Characters: your characters, community characters, and permission-based featured personalities.</li>
        <li>Credits, subscriptions, refunds for failed generations, and cancellations.</li>
        <li>Content rules and how we handle reports.</li>
        <li>Trademarks: style names describe an aesthetic; the product isn’t affiliated with Roblox Corporation or Mojang Studios.</li>
      </ul>
    </Prose>
  );
}

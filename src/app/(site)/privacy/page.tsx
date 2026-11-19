import type { Metadata } from "next";
import { DraftNotice, Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <Prose title="Privacy policy">
      <DraftNotice />
      <h2>What this will cover</h2>
      <ul>
        <li>Account data: email, display name, handle, and linked wallet addresses (public addresses only — never keys).</li>
        <li>Content: your prompts, generated scripts, characters and videos, and who can see them.</li>
        <li>Service providers that process prompts, narration or payments on our behalf.</li>
        <li>Usage data such as play counts, and how long we keep things.</li>
        <li>Your choices: deleting videos and characters, and closing your account.</li>
      </ul>
    </Prose>
  );
}

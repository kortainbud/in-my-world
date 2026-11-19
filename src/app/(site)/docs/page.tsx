import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Documentation" };

export default function Docs() {
  return (
    <Prose title="Documentation" lead="Everything you need to make your first video and get the most out of the studio.">
      <h2>Making a video</h2>
      <p>Open the <Link href="/studio">studio</Link>, describe what happens in your world, pick a visual style and a length, and press <strong>Create my world</strong>. You’ll see the cost in credits before you start.</p>
      <p>Strong prompts state one clear rule and let the story explore it: “In my world, everyone has a number above their head.” You can also pick characters to cast — the first one becomes the lead.</p>
      <h2>What happens after you press create</h2>
      <ul>
        <li><strong>Writing your story</strong> — the idea becomes a short script with a hook, scenes and an ending.</li>
        <li><strong>Building your characters</strong> — library characters are reused and new ones designed.</li>
        <li><strong>Creating your world</strong> — environments and props are chosen for each scene.</li>
        <li><strong>Animating your scenes</strong> — actions, expressions and camera moves are planned.</li>
        <li><strong>Recording narration</strong> — voice-over and dialogue are recorded and measured.</li>
        <li><strong>Editing your video</strong> — captions are timed to the voice, music and sound effects placed.</li>
        <li><strong>Final rendering</strong> — every frame is rendered and encoded to MP4.</li>
      </ul>
      <p>The progress screen reflects the real state of your job. If something fails, your credits are refunded automatically and you can try again.</p>
      <h2>How stories are built</h2>
      <p>Every story needs a rule, a reason to care, something that threatens the rule, and a twist that changes everything. Scripts follow an eight-part structure — hook, world rule, character, escalation (curiosity → concern → urgency), discovery, twist, cliffhanger and continuation — and every finished video shows its filled-in <strong>story sheet</strong>.</p>
      <ul>
        <li><strong>Strange world</strong> — one rule governs a society; someone breaks it.</li>
        <li><strong>Mystery series</strong> — each episode reveals a piece of a bigger mystery. Use <strong>Make Part 2</strong> on a finished video to continue with the same world and cast.</li>
        <li><strong>Impossible choice</strong> — the story ends on two options, shown on screen.</li>
      </ul>
      <p>Each story uses one primary twist (identity, rule reversal, betrayal, consequence, perspective or loop) and one ending device. Narration speeds up in action and slows down for revelations; the music drops to silence right before the twist, and open-ended stories cut abruptly.</p>
      <p>The <strong>editorial checklist</strong> on each project checks the story against the studio’s rules. With Claude configured, an AI editor grades it and asks for one rewrite if needed; without it, structural checks run and subjective items are left for you.</p>
      <h2>Measuring what works</h2>
      <p>The project page shows views, first-3-second retention, average watch time, completion rate, rewatches, shares and returning viewers — from plays inside In My World only (your own plays don’t count).</p>
      <h2>Visual styles</h2>
      <p>The smooth blocky style uses rounded plastic-like avatars and bright worlds. The voxel style uses cube heads, pixel textures and block terrain. Characters keep their colours and accessories in both.</p>
      <h2>Characters</h2>
      <p>Save the characters from any finished story, or build your own in <Link href="/studio/characters/new">the character creator</Link>. Each character is private by default; make it public to share it, and choose whether others may cast it. Featured personalities are only available with the person’s permission, and some are limited to paid plans.</p>
      <h2>Downloading and sharing</h2>
      <p>Finished videos download as vertical H.264 MP4s. <strong>Copy share link</strong> makes a video public and copies a link anyone can watch; you can make it private again from the project page.</p>
      <h2>Credits</h2>
      <p>See <Link href="/pricing#credits">how credits work</Link>. Cost depends on length, narration and export quality.</p>
      <h2>Wallets</h2>
      <p>You can sign in with or link a Solana wallet such as Phantom, Solflare or Backpack. This only proves you own the wallet by signing a one-time message. It never authorises a transaction, and we will never ask for your seed phrase or private key. Paying with crypto is a separate option at checkout.</p>
    </Prose>
  );
}

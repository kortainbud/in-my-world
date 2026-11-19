import type { Metadata } from "next";
import Link from "next/link";
import { PublicCharacters } from "@/components/site/public-characters";
import { CharacterShowcase } from "@/components/site/home-client";
import { btn } from "@/components/ui/btn";

export const metadata: Metadata = { title: "Characters" };

export default function CharactersPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-display-sm sm:text-display">characters.</h1>
          <p className="mt-3 max-w-lg text-body text-fg-2">Build your own characters — any skin tone, hairstyle and outfit — or start from the official crew and community creations.</p>
        </div>
        <Link href="/sign-up?next=/studio/characters/new" className={btn("primary", "md")}>build a character</Link>
      </div>
      <div className="mt-12">
        <CharacterShowcase />
      </div>
      <h2 className="mb-5 mt-20 text-title font-semibold tracking-[-0.02em]">the library.</h2>
      <PublicCharacters />
    </div>
  );
}

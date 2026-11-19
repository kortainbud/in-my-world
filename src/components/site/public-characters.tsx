"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { REUSE_LABELS, type CharacterRecord } from "@/lib/engine/characters";
import { api } from "@/lib/client/api";
import { CharacterSourceTag } from "@/components/explore";
import { Portrait } from "@/components/portrait";

export function PublicCharacters() {
  const [chars, setChars] = useState<CharacterRecord[] | null>(null);
  useEffect(() => {
    api<{ characters: CharacterRecord[] }>("/api/characters").then((d) => setChars(d.characters)).catch(() => setChars([]));
  }, []);
  if (!chars) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-60 animate-pulse rounded-[12px] bg-bg-2" />)}</div>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {chars.map((c) => (
        <Link key={c.id} href={`/sign-up?next=${encodeURIComponent(`/studio?cast=${c.id}`)}`} className="rounded-[12px] border border-line-soft bg-bg-2 p-3 transition-colors hover:border-line">
          <Portrait appearance={c.appearance} full className="mx-auto h-36 w-28" alt={c.name} />
          <div className="mt-2 flex items-center justify-between gap-1">
            <span className="truncate text-[14px] font-medium">{c.name}</span>
          </div>
          <div className="mt-1.5">
            <CharacterSourceTag source={c.source} />
          </div>
          <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-fg-2">{c.personality}</p>
          <p className="mt-2 text-[11px] text-fg-3">{REUSE_LABELS[c.reusePolicy]}</p>
        </Link>
      ))}
    </div>
  );
}

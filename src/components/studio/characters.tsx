"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { REUSE_LABELS } from "@/lib/engine/characters";
import { api, ApiError } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { CharacterSourceTag } from "@/components/explore";
import { Portrait } from "@/components/portrait";
import { Button, Empty, LinkButton, Modal, Notice, Tag } from "@/components/ui";
import type { CastableCharacter } from "./cast-picker";
import { PageHeader } from "./shell";

const TABS = [
  { id: "library", label: "Library" },
  { id: "featured", label: "Featured" },
  { id: "mine", label: "My characters" },
] as const;

export function CharactersScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "library") as (typeof TABS)[number]["id"];
  const [chars, setChars] = useState<CastableCharacter[] | null>(null);
  const [del, setDel] = useState<CastableCharacter | null>(null);
  const [notice, setNotice] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const { me } = useMe();

  const load = useCallback(() => {
    setChars(null);
    api<{ characters: CastableCharacter[] }>(`/api/characters?scope=${tab}`).then((d) => setChars(d.characters)).catch(() => setChars([]));
  }, [tab]);
  useEffect(load, [load]);

  const mineCount = chars && tab === "mine" ? chars.length : null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
      <PageHeader
        title="Characters"
        sub="Cast a character once and reuse it in every story. Looks, outfit and personality stay consistent."
        actions={<LinkButton href="/studio/characters/new" variant="primary">New character</LinkButton>}
      />
      <div role="tablist" aria-label="Character collections" className="mb-6 flex gap-1 border-b border-line-soft">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => router.replace(t.id === "library" ? pathname : `${pathname}?tab=${t.id}`, { scroll: false })}
            className={`-mb-px h-10 border-b-2 px-3 text-body transition-colors ${tab === t.id ? "border-accent text-fg" : "border-transparent text-fg-2 hover:text-fg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {notice && <Notice tone={notice.tone} className="mb-4">{notice.text}</Notice>}
      {tab === "mine" && me && mineCount !== null && (
        <p className="mb-4 text-caption text-fg-3">
          {mineCount} of {me.plan.privateCharacters} saved characters on the {me.plan.name} plan.
        </p>
      )}
      {!chars && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-[12px] bg-bg-2" />)}</div>}
      {chars && chars.length === 0 && (
        <Empty
          title={tab === "mine" ? "No characters yet" : "Nothing here"}
          body={tab === "mine" ? "Build one with the character creator, or save the new characters from a finished story." : undefined}
          action={tab === "mine" ? <LinkButton href="/studio/characters/new" variant="primary">Create a character</LinkButton> : undefined}
        />
      )}
      {chars && chars.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {chars.map((c) => (
            <article key={c.id} className="flex flex-col rounded-[12px] border border-line-soft bg-bg-2 p-3">
              <div className="relative rounded-[9px] bg-bg">
                <Portrait appearance={c.appearance} full pose="wave" className="mx-auto h-44 w-36" alt={c.name} />
                <span className="absolute left-2 top-2">{c.isMine ? <Tag>{c.visibility === "public" ? "Yours · public" : "Yours · private"}</Tag> : <CharacterSourceTag source={c.source} />}</span>
              </div>
              <h3 className="mt-3 text-body font-semibold tracking-[-0.01em]">{c.name}</h3>
              <p className="mt-1 line-clamp-2 text-caption leading-snug text-fg-2">{c.description || c.personality || "No description."}</p>
              {c.permissionNote && <p className="mt-2 text-micro leading-snug text-fg-3">{c.permissionNote}</p>}
              <p className="mt-2 text-micro text-fg-3">
                {REUSE_LABELS[c.reusePolicy]} · {c.uses} {c.uses === 1 ? "story" : "stories"}
              </p>
              <div className="mt-auto flex gap-1.5 pt-3">
                {c.cast.ok ? (
                  <LinkButton href={`/studio?cast=${c.id}`} size="sm" variant="primary" className="flex-1">
                    Cast in a story
                  </LinkButton>
                ) : (
                  <span className="flex h-8 flex-1 items-center justify-center rounded-[7px] border border-dashed border-line px-2 text-center text-micro leading-tight text-fg-3" title={c.cast.reason}>
                    {c.reusePolicy === "paid_plans" ? (
                      <Link href="/studio/billing" className="hover:text-fg">
                        Creator & Pro
                      </Link>
                    ) : (
                      "Not castable"
                    )}
                  </span>
                )}
                {c.isMine && (
                  <>
                    <LinkButton href={`/studio/characters/${c.id}`} size="sm">
                      Edit
                    </LinkButton>
                    <Button size="sm" variant="ghost" onClick={() => setDel(c)} aria-label={`Delete ${c.name}`}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal open={!!del} onClose={() => setDel(null)} label="Delete character">
        {del && (
          <div className="w-[min(420px,92vw)] rounded-[14px] border border-line bg-bg-2 p-5">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Delete {del.name}?</h2>
            <p className="mt-2 text-small text-fg-2">Videos already made with {del.name} stay as they are. You just won’t be able to cast them again.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setDel(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await api(`/api/characters/${del.id}`, { method: "DELETE" });
                    setNotice({ tone: "accent", text: `Deleted ${del.name}.` });
                    load();
                  } catch (e) {
                    setNotice({ tone: "danger", text: e instanceof ApiError ? e.message : "Couldn't delete." });
                  }
                  setDel(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

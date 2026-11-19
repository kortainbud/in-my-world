"use client";
import { useEffect, useState } from "react";
import type { CharacterRecord } from "@/lib/engine/characters";
import { SOURCE_LABELS } from "@/lib/engine/characters";
import type { VisualStyle } from "@/lib/engine/types";
import { api } from "@/lib/client/api";
import { Portrait } from "@/components/portrait";
import { Button, Modal, Tag } from "@/components/ui";

export type CastableCharacter = CharacterRecord & { cast: { ok: boolean; reason?: string }; isMine: boolean };

export function useLibrary() {
  const [chars, setChars] = useState<CastableCharacter[] | null>(null);
  useEffect(() => {
    api<{ characters: CastableCharacter[] }>("/api/characters").then((d) => setChars(d.characters)).catch(() => setChars([]));
  }, []);
  return chars;
}

export function CastPicker({ open, onClose, selected, onChange, style, library }: { open: boolean; onClose: () => void; selected: string[]; onChange: (ids: string[]) => void; style: VisualStyle; library: CastableCharacter[] | null }) {
  const [draft, setDraft] = useState(selected);
  useEffect(() => setDraft(selected), [selected, open]);
  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length >= 3 ? d : [...d, id]));
  return (
    <Modal open={open} onClose={onClose} label="Choose your cast">
      <div className="flex max-h-[88vh] w-[min(760px,94vw)] flex-col rounded-[16px] border border-line bg-[var(--card)]">
        <div className="border-b border-line-soft p-5">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Choose your cast</h2>
          <p className="mt-1 text-small text-fg-2">Pick up to 3. The first one becomes the main character. Leave it empty and we’ll cast the story for you.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3 md:grid-cols-4">
          {library === null && <p className="col-span-full p-6 text-center text-small text-fg-3">Loading characters…</p>}
          {library?.map((c) => {
            const idx = draft.indexOf(c.id);
            const on = idx >= 0;
            return (
              <button
                key={c.id}
                type="button"
                disabled={!c.cast.ok}
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                title={c.cast.ok ? undefined : c.cast.reason}
                className={`relative flex flex-col items-center rounded-[12px] border p-2 pb-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${on ? "border-accent bg-[var(--accent-soft)]" : "border-line-soft bg-bg hover:border-line"}`}
              >
                {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-micro font-semibold text-accent-ink">{idx + 1}</span>}
                <Portrait appearance={c.appearance} style={style} className="h-28 w-24" />
                <span className="mt-1 w-full truncate text-center text-small font-medium">{c.name}</span>
                <span className="mt-1 flex flex-wrap justify-center gap-1">
                  {c.isMine ? <Tag>Yours</Tag> : <Tag tone={c.source === "featured_personality" ? "accent" : "default"}>{SOURCE_LABELS[c.source]}</Tag>}
                </span>
                {!c.cast.ok && <span className="mt-1 text-center text-micro leading-tight text-fg-3">{c.cast.reason}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line-soft p-4">
          <Button variant="ghost" onClick={() => setDraft([])}>
            Clear
          </Button>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                onChange(draft);
                onClose();
              }}
            >
              Use {draft.length ? `${draft.length} character${draft.length > 1 ? "s" : ""}` : "auto-cast"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

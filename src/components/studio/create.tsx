"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import { DURATIONS, FORMATS, type DurationPreset, type StoryFormat, type VisualStyle } from "@/lib/engine/types";
import type { Premise } from "@/lib/engine/premises";
import { PROMPT_STARTERS, STYLE_LABELS } from "@/config/site";
import { api, ApiError } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import { Portrait } from "@/components/portrait";
import { Button, Notice, Spinner, Tag } from "@/components/ui";
import { CastPicker, useLibrary } from "./cast-picker";

const DRAFT_KEY = "imw:create-draft";

export const FORMAT_INFO: Record<StoryFormat, { label: string; blurb: string }> = {
  strange_world: { label: "Strange world", blurb: "One strange rule governs a town. Someone breaks it." },
  mystery_series: { label: "Mystery series", blurb: "Each episode reveals one piece. Ends on a cliffhanger." },
  impossible_choice: { label: "Impossible choice", blurb: "Two options, both with a cost. The audience decides." },
};
const MILO = OFFICIAL_CHARACTERS[0].appearance;

interface Quote {
  cost: { total: number; lines: { label: string; credits: number }[] };
  balance: number;
  allowed: boolean;
  maxDurationSec: number;
  planName: string;
}

function starterText(s: string) {
  return s.replace(/\.\.\.$/, "").replace(/^In my world$/, "In my world,") + " ";
}

export function CreateScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { me, providers, voices, refresh } = useMe();
  const library = useLibrary();
  const ta = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<VisualStyle>("roblox");
  const [format, setFormat] = useState<StoryFormat>("strange_world");
  const [ideas, setIdeas] = useState<{ list: Premise[]; source: string } | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [duration, setDuration] = useState<DurationPreset>(30);
  const [cast, setCast] = useState<string[]>([]);
  const [voice, setVoice] = useState<string>("");
  const [picker, setPicker] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const idem = useRef<string>("");

  // Initial state: URL params (templates, "cast this character") win over a saved draft.
  useEffect(() => {
    idem.current = crypto.randomUUID();
    let draft: { prompt?: string; style?: VisualStyle; duration?: DurationPreset; format?: StoryFormat } = {};
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}");
    } catch {}
    const p = params.get("prompt");
    const s = params.get("style") as VisualStyle | null;
    const c = params.get("cast");
    setPrompt(p ?? draft.prompt ?? "");
    setStyle(s === "minecraft" || s === "roblox" ? s : (draft.style ?? "roblox"));
    if (draft.duration && DURATIONS.includes(draft.duration)) setDuration(draft.duration);
    const f = (params.get("format") ?? draft.format) as StoryFormat | null;
    if (f && FORMATS.includes(f)) setFormat(f);
    if (c) setCast(c.split(",").slice(0, 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (voices.length && !voice) setVoice(voices[0].id);
  }, [voices, voice]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ prompt, style, duration, format }));
    } catch {}
  }, [prompt, style, duration, format]);

  useEffect(() => {
    let live = true;
    api<Quote>(`/api/quote?duration=${duration}&style=${style}`).then((q) => live && setQuote(q)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [duration, style, me?.balance]);

  // If the plan doesn't allow the chosen length, fall back to the longest allowed.
  useEffect(() => {
    if (me && duration > me.plan.maxDurationSec) setDuration(me.plan.maxDurationSec);
  }, [me, duration]);

  const castChars = useMemo(() => cast.map((id) => library?.find((c) => c.id === id)).filter(Boolean), [cast, library]);
  const trimmed = prompt.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 8;
  const isOnlyStarter = PROMPT_STARTERS.some((s) => starterText(s).trim() === trimmed);
  const canAfford = quote ? quote.balance >= quote.cost.total : true;
  const ready = trimmed.length >= 8 && !isOnlyStarter && !!quote && quote.allowed && canAfford && !submitting && !!providers?.story.id;

  const insertStarter = (s: string) => {
    const text = starterText(s);
    const el = ta.current;
    if (!trimmed || PROMPT_STARTERS.some((x) => starterText(x).trim() === trimmed)) {
      setPrompt(text);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(text.length, text.length);
      });
      return;
    }
    const pos = el?.selectionStart ?? prompt.length;
    const next = prompt.slice(0, pos) + (pos > 0 && !/\s$/.test(prompt.slice(0, pos)) ? " " : "") + text + prompt.slice(pos);
    setPrompt(next);
    requestAnimationFrame(() => el?.focus());
  };

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<{ projectId: string }>("/api/generate", {
        method: "POST",
        json: { prompt: trimmed, style, duration, format, castIds: cast, voice: voice || null, idempotencyKey: idem.current },
      });
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      void refresh();
      router.push(`/studio/projects/${r.projectId}`);
    } catch (e) {
      setError(e instanceof ApiError ? { message: e.message, code: e.code } : { message: "Couldn't start your video. Check your connection and try again." });
      // A failed request didn't create a job; a new key lets the next attempt go through.
      if (!(e instanceof ApiError) || e.status !== 200) idem.current = crypto.randomUUID();
      setSubmitting(false);
    }
  };

  const maxDur = me?.plan.maxDurationSec ?? 30;

  return (
    <div className="mx-auto w-full max-w-[820px] px-4 pb-24 pt-8 sm:px-6 lg:pt-14">
      <h1 className="display text-center text-[40px] sm:text-[56px]">What happens in your world?</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-[15px] text-fg-2">One sentence is enough. We’ll write it, cast it, animate it, narrate it and cut it.</p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="rounded-[14px] border border-line bg-bg-2 transition-colors focus-within:border-[#4a4a4a]">
          <label htmlFor="prompt" className="sr-only">
            Your idea
          </label>
          <textarea
            id="prompt"
            ref={ta}
            value={prompt}
            maxLength={600}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            placeholder="In my world, everyone gets richer every time they tell a lie..."
            rows={4}
            className="block min-h-[132px] w-full resize-y rounded-[14px] bg-transparent px-5 pt-4 text-[19px] leading-relaxed text-fg outline-none placeholder:text-fg-3 sm:text-[21px]"
          />
          <div className="flex items-center justify-between px-5 pb-3 text-[12px] text-fg-3">
            <span>{tooShort ? "Keep going — a few more words." : isOnlyStarter ? "Finish the sentence." : "Tip: ⌘/Ctrl + Enter to create"}</span>
            <span className={prompt.length > 560 ? "text-warn" : ""}>{prompt.length}/600</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Prompt starters">
          {PROMPT_STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => insertStarter(s)} className="h-8 rounded-[8px] border border-line-soft bg-bg px-3 text-[13px] text-fg-2 transition-colors hover:border-line hover:text-fg">
              {s}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <button
            type="button"
            disabled={ideasBusy}
            onClick={async () => {
              setIdeasBusy(true);
              try {
                const d = await api<{ premises: Premise[]; source: string }>("/api/premises", { method: "POST", json: { avoid: ideas?.list.map((x) => x.premise) ?? [] } });
                setIdeas({ list: d.premises, source: d.source });
              } catch (e) {
                setError({ message: e instanceof ApiError ? e.message : "Couldn't load ideas." });
              } finally {
                setIdeasBusy(false);
              }
            }}
            className="text-[13px] text-fg-2 underline decoration-line underline-offset-4 hover:text-fg disabled:opacity-50"
          >
            {ideasBusy ? "Finding ideas…" : ideas ? "Show different ideas" : "Need an idea? Show me premises"}
          </button>
          {ideas && (
            <div className="mt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {ideas.list.map((pr) => (
                  <button
                    key={pr.premise}
                    type="button"
                    onClick={() => {
                      setPrompt(pr.premise + " " + pr.rule);
                      setFormat(pr.format);
                      ta.current?.focus();
                    }}
                    className="rounded-[12px] border border-line-soft bg-bg-2 p-3.5 text-left transition-colors hover:border-line"
                  >
                    <span className="block text-[14px] font-medium leading-snug">{pr.premise}</span>
                    <span className="mt-1 block text-[12.5px] leading-snug text-fg-2">{pr.rule}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-3">
                      <Tag>{FORMAT_INFO[pr.format].label}</Tag> {pr.why}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-fg-3">{ideas.source === "anthropic" ? "Generated by Claude for you." : "From the studio's premise library."} Each one comes with a hidden secret the story builds towards.</p>
            </div>
          )}
        </div>

        <div className="mt-8 divide-y divide-line-soft rounded-[14px] border border-line bg-bg-2">
          <Row label="Story format" hint="How the story is shaped and how it ends.">
            <div role="radiogroup" aria-label="Story format" className="grid gap-2 sm:grid-cols-3">
              {FORMATS.map((f) => {
                const on = format === f;
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFormat(f)}
                    className={`rounded-[10px] border p-2.5 text-left transition-colors ${on ? "border-accent bg-[#161d0f]" : "border-line-soft bg-bg hover:border-line"}`}
                  >
                    <span className="block text-[13.5px] font-medium">{FORMAT_INFO[f].label}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-fg-2">{FORMAT_INFO[f].blurb}</span>
                  </button>
                );
              })}
            </div>
          </Row>
          <Row label="Visual style" hint="Changes the characters, worlds and textures.">
            <div role="radiogroup" aria-label="Visual style" className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
              {(["roblox", "minecraft"] as const).map((s) => {
                const on = style === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setStyle(s)}
                    className={`relative flex items-center gap-3 rounded-[10px] border p-2 pr-3 text-left transition-colors ${on ? "border-accent bg-[#161d0f]" : "border-line-soft bg-bg hover:border-line"}`}
                  >
                    <Portrait appearance={MILO} style={s} className="h-14 w-12 shrink-0" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[14px] font-medium">
                        {STYLE_LABELS[s].label}
                        {s === "roblox" && <span className="text-[11px] font-normal text-fg-3">default</span>}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-fg-2">{STYLE_LABELS[s].blurb}</span>
                    </span>
                    <span className={`absolute right-2.5 top-2.5 h-3.5 w-3.5 rounded-full border-2 ${on ? "border-accent bg-accent" : "border-line"}`} aria-hidden />
                  </button>
                );
              })}
            </div>
          </Row>

          <Row label="Video length" hint={`Your ${me?.plan.name ?? "Free"} plan goes up to ${maxDur} seconds.`}>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="Video length" className="inline-flex rounded-[9px] border border-line bg-bg p-0.5">
                {DURATIONS.map((d) => {
                  const locked = d > maxDur;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={duration === d}
                      disabled={locked}
                      onClick={() => setDuration(d)}
                      className={`h-8 rounded-[7px] px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${duration === d ? "bg-fg text-bg" : locked ? "text-fg-3" : "text-fg-2 hover:text-fg"}`}
                    >
                      {d}s{locked && <LockIcon />}
                    </button>
                  );
                })}
              </div>
              {maxDur < 90 && (
                <Link href="/studio/billing" className="text-[12.5px] text-fg-2 underline decoration-line underline-offset-4 hover:text-fg">
                  Longer videos on paid plans
                </Link>
              )}
            </div>
          </Row>

          <Row label="Aspect ratio">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-accent bg-[#161d0f] px-3 text-[13px] font-medium">
                <span className="h-3.5 w-2 rounded-[2px] border-[1.5px] border-accent" aria-hidden />
                9:16 vertical
              </span>
              <span className="text-[12px] text-fg-3">More ratios later</span>
            </div>
          </Row>

          <Row label="Creation mode">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-[8px] border border-accent bg-[#161d0f] px-3 text-[13px] font-medium">Fully automatic</span>
              {["Guided creation", "Advanced editing"].map((m) => (
                <span key={m} aria-disabled="true" className="inline-flex h-8 cursor-not-allowed items-center gap-2 rounded-[8px] border border-dashed border-line px-3 text-[13px] text-fg-3">
                  {m}
                  <span className="rounded-[4px] bg-bg-3 px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-fg-2">Coming soon</span>
                </span>
              ))}
            </div>
          </Row>

          <Row label="Cast" hint="Optional. Reuse your characters or featured ones.">
            <div className="flex flex-wrap items-center gap-2">
              {castChars.length === 0 && <span className="text-[13px] text-fg-2">Auto-cast from the library</span>}
              {castChars.map((c, i) => (
                <span key={c!.id} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line bg-bg pl-1 pr-2 text-[13px]">
                  <Portrait appearance={c!.appearance} style={style} className="h-6 w-6" />
                  {c!.name}
                  {i === 0 && <span className="text-[11px] text-fg-3">lead</span>}
                  <button type="button" aria-label={`Remove ${c!.name}`} className="ml-0.5 text-fg-3 hover:text-fg" onClick={() => setCast(cast.filter((x) => x !== c!.id))}>
                    ×
                  </button>
                </span>
              ))}
              <Button type="button" size="sm" onClick={() => setPicker(true)}>
                {castChars.length ? "Change" : "Choose characters"}
              </Button>
            </div>
          </Row>

          <Row label="Narrator">
            {voices.length ? (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Narrator voice">
                {voices.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={voice === v.id}
                    onClick={() => setVoice(v.id)}
                    className={`h-8 rounded-[8px] border px-3 text-[13px] transition-colors ${voice === v.id ? "border-accent bg-[#161d0f] text-fg" : "border-line-soft bg-bg text-fg-2 hover:text-fg"}`}
                  >
                    {v.label} <span className="text-fg-3">· {v.accent}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[13px] text-fg-2">No narration provider is configured — videos get captions and music only.</span>
            )}
          </Row>
        </div>

        {providers?.mode === "development" && (
          <Notice tone="warn" className="mt-4">
            <strong className="font-medium">Development mode.</strong> Story: {providers.story.label}. Voice: {providers.voice.label}. Rendering happens in this browser tab with WebCodecs — keep the tab open until your video finishes.
          </Notice>
        )}
        {providers && !providers.story.id && <Notice tone="danger" className="mt-4">Video generation is unavailable: no story provider is configured.</Notice>}

        {error && (
          <Notice tone="danger" className="mt-4">
            {error.message}{" "}
            {error.code === "insufficient_credits" && (
              <Link href="/studio/billing" className="underline underline-offset-4">
                Get more credits
              </Link>
            )}
          </Notice>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line-soft bg-bg/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px] text-fg-2">
              {quote ? (
                <>
                  <span className="text-fg">
                    Estimated cost: <strong className="font-semibold">{quote.cost.total} credits</strong>
                  </span>
                  <span className="mx-2 text-fg-3">·</span>
                  {canAfford ? (
                    <>
                      {quote.balance} available → {quote.balance - quote.cost.total} after
                    </>
                  ) : (
                    <span className="text-warn">
                      You have {quote.balance}.{" "}
                      <Link href="/studio/billing" className="underline underline-offset-4">
                        Get credits
                      </Link>
                    </span>
                  )}
                  <span className="mt-0.5 block text-[11.5px] text-fg-3">{quote.cost.lines.map((l) => `${l.label} ${l.credits}`).join(" · ")} · refunded automatically if generation fails</span>
                </>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Checking cost…
                </span>
              )}
            </div>
            <Button type="submit" variant="primary" size="lg" disabled={!ready} className="min-w-[200px]">
              {submitting ? (
                <>
                  <Spinner /> Starting…
                </>
              ) : (
                "Create my world"
              )}
            </Button>
          </div>
        </div>
      </form>

      <CastPicker open={picker} onClose={() => setPicker(false)} selected={cast} onChange={setCast} style={style} library={library} />
      {me?.plan.watermark && (
        <p className="mt-6 text-center text-[12px] text-fg-3">
          Free plan videos export at 720p with a small watermark. <Tag className="ml-1">Creator & Pro: 1080p, no watermark</Tag>
        </p>
      )}
    </div>
  );
}

export function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-label="Locked" className="ml-1 inline -translate-y-px">
      <rect x="1.5" y="4.5" width="7" height="5" rx="1" fill="currentColor" />
      <path d="M3 4.5V3a2 2 0 014 0v1.5" stroke="currentColor" fill="none" strokeWidth="1.2" />
    </svg>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-[170px_1fr] sm:items-center sm:gap-5">
      <div>
        <p className="text-[13.5px] font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

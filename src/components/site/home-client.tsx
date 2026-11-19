"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/lib/engine/types";
import type { SampleEntry } from "@/lib/server/views";
import { fmtDuration } from "@/lib/client/api";
import { OFFICIAL_CHARACTERS, SOURCE_LABELS } from "@/lib/engine/characters";
import { Portrait } from "@/components/portrait";
import { btn, StyleTag, Tag } from "@/components/ui";
import { VideoCard, VideoModal, type VideoItem } from "@/components/video";

/* ---------------- Hero: idea → finished video ---------------- */

export function HeroDemo({ samples }: { samples: SampleEntry[] }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<"typing" | "building" | "playing">("typing");
  const [stage, setStage] = useState(0);
  const vref = useRef<HTMLVideoElement>(null);
  const s = samples[i % Math.max(1, samples.length)];

  useEffect(() => {
    if (!s) return;
    setTyped(0);
    setStage(0);
    setPhase("typing");
  }, [i, s]);

  useEffect(() => {
    if (!s) return;
    if (phase === "typing") {
      if (typed >= s.prompt.length) {
        const t = setTimeout(() => setPhase("building"), 500);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setTyped((n) => n + 1), 28 + Math.random() * 30);
      return () => clearTimeout(t);
    }
    if (phase === "building") {
      if (stage >= STAGES.length) {
        setPhase("playing");
        return;
      }
      const t = setTimeout(() => setStage((n) => n + 1), 220);
      return () => clearTimeout(t);
    }
    if (phase === "playing") {
      const v = vref.current;
      if (v) {
        v.currentTime = 0;
        void v.play().catch(() => undefined);
      }
    }
  }, [phase, typed, stage, s]);

  if (!s)
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-[18px] border border-line bg-bg-2 text-[13px] text-fg-3">
        Sample videos haven’t been generated yet.
      </div>
    );

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-line bg-bg-2">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "linear-gradient(#262626 1px, transparent 1px), linear-gradient(90deg, #262626 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="relative grid items-center gap-8 p-5 sm:p-8 md:grid-cols-[1fr_auto] md:gap-12 md:p-12">
        <div className="min-w-0">
          <p className="eyebrow">the idea</p>
          <p className="mt-3 min-h-[3.6em] text-[22px] font-medium leading-snug tracking-[-0.02em] sm:text-[28px]" aria-live="polite">
            {s.prompt.slice(0, typed)}
            {phase === "typing" && <span className="caret ml-0.5 inline-block h-[1em] w-[3px] translate-y-[3px] bg-accent" />}
          </p>
          <ol className="mt-6 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {STAGES.map((st, k) => {
              const done = phase === "playing" || (phase === "building" && k < stage);
              return (
                <li key={st.key} className={`flex items-center gap-2 text-[13px] transition-colors ${done ? "text-fg" : "text-fg-3"}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full ${done ? "bg-accent text-accent-ink" : "border border-line"}`}>
                    {done && <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
                  </span>
                  {st.label}
                </li>
              );
            })}
          </ol>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {samples.map((x, k) => (
              <button
                key={x.id}
                onClick={() => setI(k)}
                aria-label={`Show sample: ${x.title}`}
                aria-current={k === i % samples.length}
                className={`h-1.5 rounded-full transition-all ${k === i % samples.length ? "w-8 bg-accent" : "w-3 bg-line hover:bg-fg-3"}`}
              />
            ))}
            <span className="ml-2 text-[11.5px] text-fg-3">Real output from the engine · sample</span>
          </div>
        </div>
        <div className="relative mx-auto w-[min(300px,72vw)]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[26px] border-[6px] border-[#262626] bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.thumb} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${phase === "playing" ? "opacity-0" : "opacity-30 blur-[2px]"}`} />
            <video
              ref={vref}
              key={s.video}
              src={s.video}
              muted
              playsInline
              preload="auto"
              onEnded={() => setI((n) => n + 1)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${phase === "playing" ? "opacity-100" : "opacity-0"}`}
            />
            {phase !== "playing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-[12px] font-medium text-fg-2">{phase === "typing" ? "Waiting for an idea" : STAGES[Math.min(stage, STAGES.length - 1)].label}…</span>
              </div>
            )}
            <div className="absolute left-2.5 top-2.5">
              <StyleTag style={s.style} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Product demonstration (5 steps, real artifacts) ---------------- */

const STEPS = ["Enter a story idea", "AI develops the story", "Characters enter the scene", "Scenes are generated", "A finished video"];

export function ProductDemo({ sample }: { sample?: SampleEntry }) {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3800);
    return () => clearInterval(t);
  }, [auto]);
  if (!sample?.story) return null;
  const pick = (k: number) => {
    setAuto(false);
    setStep(k);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <ol className="flex gap-2 overflow-x-auto scrollbar-none lg:flex-col" role="tablist" aria-label="How a video is made">
        {STEPS.map((s, k) => (
          <li key={s} className="shrink-0">
            <button
              role="tab"
              aria-selected={step === k}
              onClick={() => pick(k)}
              className={`flex w-full items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left text-[14px] transition-colors ${step === k ? "border-line bg-bg-2 text-fg" : "border-transparent text-fg-2 hover:text-fg"}`}
            >
              <span className={`font-mono text-[12px] ${step === k ? "text-accent" : "text-fg-3"}`}>0{k + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="min-h-[420px] rounded-[16px] border border-line bg-bg-2 p-5 sm:p-7" role="tabpanel">
        {step === 0 && (
          <div className="rise flex h-full flex-col justify-center">
            <p className="eyebrow">Prompt</p>
            <p className="mt-4 text-[26px] font-medium leading-snug tracking-[-0.02em] sm:text-[34px]">{sample.prompt}</p>
            <p className="mt-6 text-[13px] text-fg-3">One sentence. That’s the whole input.</p>
          </div>
        )}
        {step === 1 && (
          <div className="rise">
            <p className="eyebrow">Script · {sample.story.scenes.length} scenes</p>
            <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.02em]">{sample.title}</h3>
            <ol className="mt-5 space-y-3">
              {sample.story.scenes.map((sc, k) => (
                <li key={k} className="flex gap-3 text-[14px]">
                  <span className="w-6 shrink-0 font-mono text-[12px] leading-6 text-fg-3">{String(k + 1).padStart(2, "0")}</span>
                  <span className="leading-relaxed text-fg-2">{sc.narration}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {step === 2 && (
          <div className="rise">
            <p className="eyebrow">Cast</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {sample.story.cast.map((c) => (
                <div key={c.id} className="rounded-[12px] border border-line-soft bg-bg p-3 text-center">
                  <Portrait appearance={c.appearance} style={sample.style} full pose="wave" className="mx-auto h-40 w-32 sm:h-52 sm:w-40" alt={c.name} />
                  <p className="mt-2 text-[14px] font-medium">{c.name}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-fg-3">Characters keep the same look, outfit and proportions in every scene — and every future story.</p>
          </div>
        )}
        {step === 3 && (
          <div className="rise">
            <p className="eyebrow">Scenes</p>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(sample.previews ?? []).map((src, k) => (
                <figure key={src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={sample.story!.scenes[k]?.description ?? `Scene ${k + 1}`} className="aspect-[9/16] w-full rounded-[8px] border border-line-soft object-cover" />
                  <figcaption className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-fg-3">{sample.story!.scenes[k]?.environment.replace(/_/g, " ")}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="rise flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <video src={sample.video} poster={sample.thumb} controls playsInline className="aspect-[9/16] w-[220px] rounded-[12px] border border-line bg-black" />
            <div>
              <p className="eyebrow">Finished video</p>
              <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
                {fmtDuration(sample.durationSec)} · {sample.width ?? 720}×{sample.height ?? 1280} · H.264 MP4 with narration, music, sound effects and burned-in captions. Ready to post.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Examples grid ---------------- */

export function Examples({ samples }: { samples: SampleEntry[] }) {
  const [open, setOpen] = useState<VideoItem | null>(null);
  if (!samples.length) return <p className="text-[13px] text-fg-3">Sample videos haven’t been generated yet.</p>;
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        {samples.map((s) => (
          <VideoCard key={s.id} item={{ ...s, isSample: true }} onOpen={() => setOpen({ ...s, isSample: true })} />
        ))}
      </div>
      <p className="mt-6 text-[12px] text-fg-3">All examples are sample videos rendered by this product’s engine, labelled as samples.</p>
      <VideoModal item={open} onClose={() => setOpen(null)} actions={open && <Link href={`/sign-up?next=${encodeURIComponent(`/studio?prompt=${encodeURIComponent(open.prompt)}`)}`} className={btn("primary", "md")}>Make my own version</Link>} />
    </>
  );
}

/* ---------------- Character showcase ---------------- */

export function CharacterShowcase() {
  const chars = OFFICIAL_CHARACTERS;
  const [sel, setSel] = useState(chars[0].id);
  const c = chars.find((x) => x.id === sel)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      <div className="relative flex min-h-[420px] flex-col items-center justify-end overflow-hidden rounded-[16px] border border-line bg-bg-2 p-6">
        <div className="grid w-full grid-cols-2 gap-3">
          <figure className="text-center">
            <Portrait appearance={c.appearance} style="roblox" full pose="wave" className="mx-auto h-64 w-48" alt={`${c.name} in Roblox style`} />
            <figcaption className="mt-1 text-[11.5px] text-fg-3">Roblox style</figcaption>
          </figure>
          <figure className="text-center">
            <Portrait appearance={c.appearance} style="minecraft" full pose="wave" className="mx-auto h-64 w-48" alt={`${c.name} in Minecraft style`} />
            <figcaption className="mt-1 text-[11.5px] text-fg-3">Minecraft style</figcaption>
          </figure>
        </div>
        <div className="mt-5 w-full border-t border-line-soft pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{c.name}</h3>
            <Tag tone={c.source === "featured_personality" ? "accent" : "default"}>{SOURCE_LABELS[c.source]}</Tag>
          </div>
          <p className="mt-1 text-[13.5px] text-fg-2">{c.personality}</p>
          {c.permissionNote && <p className="mt-2 text-[11.5px] text-fg-3">{c.permissionNote}</p>}
        </div>
      </div>
      <div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {chars.map((x) => (
            <button
              key={x.id}
              onClick={() => setSel(x.id)}
              aria-pressed={sel === x.id}
              className={`rounded-[12px] border p-2 text-center transition-colors ${sel === x.id ? "border-accent bg-[#161d0f]" : "border-line-soft bg-bg-2 hover:border-line"}`}
            >
              <Portrait appearance={x.appearance} className="mx-auto h-24 w-20" alt="" />
              <span className="mt-1 block truncate text-[13px] font-medium">{x.name}</span>
            </button>
          ))}
        </div>
        <ul className="mt-6 space-y-3 text-[14px] text-fg-2">
          <li><span className="text-fg">Cast once, reuse forever.</span> A character keeps its face, outfit, accessories and proportions in every scene and every story.</li>
          <li><span className="text-fg">Build your own.</span> Pick skin, hair, outfit, hats and accessories — then cast them in anything.</li>
          <li><span className="text-fg">Share or keep private.</span> Each character has visibility and reuse permissions. Featured personalities appear only with permission.</li>
        </ul>
      </div>
    </div>
  );
}

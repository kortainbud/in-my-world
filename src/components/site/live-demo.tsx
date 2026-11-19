"use client";
import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/lib/engine/types";
import type { SampleEntry } from "@/lib/server/views";
import { Portrait } from "@/components/portrait";

const FORMAT: Record<string, string> = { strange_world: "strange world", mystery_series: "mystery series", impossible_choice: "impossible choice" };

/**
 * A clickable studio window built from real sample output: pick a story on
 * the left, watch the idea type in, the stages tick, the script appear and
 * the finished video play.
 */
export function LiveDemo({ samples }: { samples: SampleEntry[] }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState(0);
  const [phase, setPhase] = useState<"typing" | "building" | "playing">("typing");
  const [muted, setMuted] = useState(true);
  const vref = useRef<HTMLVideoElement>(null);
  const s = samples[i % Math.max(1, samples.length)];

  useEffect(() => {
    setTyped(0);
    setStage(0);
    setPhase("typing");
  }, [i]);

  useEffect(() => {
    if (!s) return;
    if (phase === "typing") {
      if (typed >= s.prompt.length) {
        const t = setTimeout(() => setPhase("building"), 400);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setTyped((n) => Math.min(s.prompt.length, n + 2)), 32);
      return () => clearTimeout(t);
    }
    if (phase === "building") {
      if (stage >= STAGES.length) {
        setPhase("playing");
        return;
      }
      const t = setTimeout(() => setStage((n) => n + 1), 260);
      return () => clearTimeout(t);
    }
    const v = vref.current;
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    }
  }, [phase, typed, stage, s]);

  if (!s) return null;
  const scenes = s.story?.scenes ?? [];
  const shownLines = phase === "playing" ? scenes.length : phase === "building" ? Math.round((stage / STAGES.length) * scenes.length) : 0;

  return (
    <div className="overflow-hidden rounded-[18px] border border-line-soft bg-[var(--card)] text-fg shadow-[0_40px_90px_-40px_rgba(10,40,90,0.5)]">
      <div className="flex h-10 items-center border-b border-line-soft px-4">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto text-small font-medium text-fg-2">in my world studio</span>
        <span className="w-[52px]" />
      </div>
      <div className="grid md:grid-cols-[230px_1fr_auto]">
        {/* Story list */}
        <ul className="flex gap-1 overflow-x-auto border-b border-line-soft p-2 scrollbar-none md:block md:space-y-0.5 md:overflow-visible md:border-b-0 md:border-r" aria-label="Sample stories">
          {samples.map((x, k) => {
            const on = k === i % samples.length;
            const lead = x.story?.cast[0];
            return (
              <li key={x.id} className="shrink-0 md:shrink">
                <button
                  onClick={() => setI(k)}
                  aria-pressed={on}
                  className={`flex w-[220px] items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors md:w-full ${on ? "bg-bg-2" : "hover:bg-bg-2"}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-bg-2">
                    {lead ? <Portrait appearance={lead.appearance} style={x.style} className="h-9 w-8" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-small font-semibold">{x.title.toLowerCase()}</span>
                    <span className="block truncate text-caption text-fg-3">
                      {FORMAT[x.format ?? "strange_world"]} · {x.story?.sheet?.twistType.replace(/_/g, " ")} twist
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Idea, stages, script */}
        <div className="min-w-0 p-4 sm:p-5">
          <div className="rounded-[12px] border border-line-soft p-3.5">
            <p className="font-mono text-micro text-fg-3">what happens in your world?</p>
            <p className="mt-1.5 min-h-[2.8em] text-lead font-medium leading-snug sm:text-lead" aria-live="polite">
              {s.prompt.slice(0, typed)}
              {phase === "typing" && <span className="caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-fg" />}
            </p>
          </div>
          <ol className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
            {STAGES.map((st, k) => {
              const done = phase === "playing" || (phase === "building" && k < stage);
              return (
                <li key={st.key} className={`flex items-center gap-1.5 text-caption ${done ? "text-fg" : "text-fg-3"}`}>
                  <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${done ? "bg-[#28c840] text-white" : "border border-line"}`}>
                    {done && <svg width="8" height="8" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="2.2" fill="none" /></svg>}
                  </span>
                  <span className="truncate">{st.label.toLowerCase()}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 hidden max-h-[230px] overflow-hidden sm:block">
            {s.story?.sheet && phase !== "typing" && (
              <div className="mb-3 flex flex-wrap gap-1.5 text-micro">
                <span className="rounded-full bg-[#fff1c2] px-2 py-0.5 text-[#131316]">rule: {s.story.sheet.rule.split(",")[0].toLowerCase()}</span>
                <span className="rounded-full bg-[#e3dcff] px-2 py-0.5 text-[#131316]">{s.story.sheet.twistType.replace(/_/g, " ")} twist</span>
                <span className="rounded-full bg-[#d9f2ff] px-2 py-0.5 text-[#131316]">{s.story.sheet.endingType === "open_loop" ? "cliffhanger" : "closed loop"}</span>
              </div>
            )}
            <ol className="space-y-1.5">
              {scenes.slice(0, shownLines).map((sc, k) => (
                <li key={k} className="rise flex gap-2 text-small leading-snug">
                  <span className="w-5 shrink-0 font-mono text-micro leading-[18px] text-fg-3">{String(k + 1).padStart(2, "0")}</span>
                  <span className="text-fg-2">{sc.narration}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Phone */}
        <div className="flex justify-center border-t border-line-soft p-4 md:border-l md:border-t-0">
          <div className="relative aspect-[9/16] w-[190px] overflow-hidden rounded-[22px] border-[5px] border-[#131316] bg-black sm:w-[210px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.thumb} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${phase === "playing" ? "opacity-0" : "opacity-40 blur-[2px]"}`} />
            <video
              ref={vref}
              key={s.video}
              src={s.video}
              muted={muted}
              playsInline
              preload="metadata"
              onEnded={() => setI((n) => n + 1)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${phase === "playing" ? "opacity-100" : "opacity-0"}`}
            />
            {phase !== "playing" && (
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-caption font-medium text-white">
                {phase === "typing" ? "waiting for an idea…" : `${STAGES[Math.min(stage, STAGES.length - 1)].label.toLowerCase()}…`}
              </span>
            )}
            {phase === "playing" && (
              <button onClick={() => setMuted((m) => !m)} className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-micro font-medium text-[#131316]">
                {muted ? "sound on" : "mute"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

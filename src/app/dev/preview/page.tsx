"use client";
import { useEffect, useRef, useState } from "react";
import { generateDevStory } from "@/lib/engine/devStory";
import { compileTimeline } from "@/lib/engine/compile";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import type { Timeline, VisualStyle } from "@/lib/engine/types";
import { TimelineRenderer, loadCaptionFont } from "@/lib/render/renderer";

export default function Preview() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [r, setR] = useState<TimelineRenderer | null>(null);
  const [tl, setTl] = useState<Timeline | null>(null);
  const [t, setT] = useState(1.5);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const q = new URLSearchParams(location.search);
    const prompt = q.get("p") ?? "In my world, everyone grows taller every time they help someone.";
    const style = (q.get("s") ?? "roblox") as VisualStyle;
    const plan = generateDevStory({ prompt, duration: 60, cast: [] });
    const cast = plan.cast.map((c) => { const rec = OFFICIAL_CHARACTERS.find((o) => o.id === c.characterId)!; return { id: rec.id, name: rec.name, appearance: rec.appearance }; });
    const refs = Object.fromEntries(plan.cast.map((c) => [c.ref, c.characterId!]));
    const timeline = compileTimeline({ plan, style, cast, refs, audio: [], width: 540, height: 960, watermark: true, targetDuration: 60 });
    loadCaptionFont().then(() => { const rr = new TimelineRenderer(timeline, ref.current!); setR(rr); setTl(timeline); const tt = Number(q.get("t") ?? 1.5); setT(tt); rr.renderAt(tt); (window as unknown as { __r: TimelineRenderer }).__r = rr; });
  }, []);
  useEffect(() => { r?.renderAt(t); }, [r, t]);
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ padding: 16, display: "flex", gap: 16, background: "#101010", color: "#fff", minHeight: "100vh" }}>
      <canvas ref={ref} style={{ width: 405, height: 720 }} />
      <div style={{ width: 400 }}>
        <input type="range" min={0} max={tl?.duration ?? 60} step={0.05} value={t} onChange={(e) => setT(Number(e.target.value))} style={{ width: "100%" }} />
        <div>{t.toFixed(2)}s / {tl?.duration.toFixed(1)}s</div>
        <ol>{tl?.scenes.map((s) => <li key={s.index} onClick={() => setT(s.start + s.duration * 0.55)} style={{ cursor: "pointer", marginBottom: 6, fontSize: 12 }}>{s.start.toFixed(1)}s · {s.plan.environment} · {s.plan.camera} — {s.plan.narration}</li>)}</ol>
      </div>
    </div>
  );
}

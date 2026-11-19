"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import { Portrait } from "@/components/portrait";

const BRICK_COLORS = ["#e63946", "#3d7bf2", "#f5c518", "#2a9d8f", "#f2643d", "#7a5cfa", "#7fd14f"];

/* ---------------- Theme ---------------- */

export const THEME_KEY = "imw:site-theme";

/** Runs before paint (inlined in the site layout) so there's no flash. */
export const THEME_SCRIPT = `try{var q=new URLSearchParams(location.search).get("theme");if(q==="dark"||q==="light")localStorage.setItem("${THEME_KEY}",q);var t=localStorage.getItem("${THEME_KEY}");if(t==="dark")document.documentElement.dataset.siteTheme="dark";}catch(e){}`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.siteTheme === "dark"), []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.siteTheme = "dark";
    else delete document.documentElement.dataset.siteTheme;
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      onClick={flip}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-fg transition-colors hover:bg-bg-2 ${className}`}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="3.6" fill="currentColor" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><path d="M14.5 11.2A6.5 6.5 0 016.8 3.5a6.5 6.5 0 107.7 7.7z" fill="currentColor" /></svg>
      )}
    </button>
  );
}

/** Day and night versions of a rendered scene; CSS shows the right one. */
export function Scene({ name, night, className = "", alt = "", png }: { name: string; night?: string; className?: string; alt?: string; png?: boolean }) {
  const ext = png ? "png" : "jpg";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/scenes/${name}.${ext}`} alt={alt} className={`scene-day ${className}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/scenes/${night ?? `${name}-night`}.${ext}`} alt={alt} loading="lazy" className={`scene-night ${className}`} />
    </>
  );
}

/* ---------------- Bricks ---------------- */

export function Brick({ size = 40, color = "#e63946", style, className = "" }: { size?: number; color?: string; style?: CSSProperties; className?: string }) {
  return (
    <span aria-hidden className={`brick ${className}`} style={{ ["--s" as string]: `${size}px`, ["--c" as string]: color, ...style }}>
      <i className="t" />
      <i className="f" />
      <i className="b" />
      <i className="l" />
      <i className="r" />
    </span>
  );
}

type Floater = { top: number; left: number; speed: number; rot: number } & ({ kind: "brick"; s: number; c: number } | { kind: "img"; src: string; w: number });

/** Bricks plus little pieces of the world: trees, houses, clouds, towers, land. */
const FLOATERS: Floater[] = [
  { kind: "img", src: "obj-cloud", w: 120, top: 3, left: 2, speed: -0.1, rot: 0.01 },
  { kind: "brick", s: 30, c: 1, top: 9, left: 92, speed: 0.16, rot: -0.05 },
  { kind: "img", src: "obj-tree", w: 96, top: 17, left: 90, speed: -0.06, rot: 0.02 },
  { kind: "brick", s: 22, c: 2, top: 22, left: 4, speed: 0.2, rot: 0.06 },
  { kind: "img", src: "obj-house", w: 104, top: 31, left: 1.5, speed: 0.12, rot: -0.015 },
  { kind: "img", src: "obj-chunk", w: 90, top: 40, left: 91, speed: -0.14, rot: 0.02 },
  { kind: "brick", s: 26, c: 0, top: 50, left: 3, speed: -0.18, rot: 0.05 },
  { kind: "img", src: "obj-tower", w: 84, top: 57, left: 92, speed: 0.1, rot: -0.02 },
  { kind: "img", src: "obj-tree-round", w: 92, top: 66, left: 2.5, speed: 0.15, rot: 0.02 },
  { kind: "brick", s: 28, c: 6, top: 74, left: 91, speed: -0.12, rot: -0.06 },
  { kind: "img", src: "obj-cloud", w: 110, top: 82, left: 89, speed: 0.08, rot: -0.01 },
];

/**
 * Bricks and bits of world that drift through the page margins as you
 * scroll. Kept to the edges so they never sit on top of content.
 */
export function FloatingBricks() {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      const y = window.scrollY;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const f = FLOATERS[i];
        el.style.transform =
          f.kind === "brick"
            ? `translate3d(0, ${y * f.speed}px, 0) rotateX(-28deg) rotateY(${35 + y * f.rot}deg) rotateZ(${Math.sin(y * 0.002 + i) * 8}deg)`
            : `translate3d(0, ${y * f.speed}px, 0) rotate(${Math.sin(y * 0.0015 + i) * 6 + y * f.rot * 0.2}deg)`;
      });
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden xl:block">
      {FLOATERS.map((f, i) => (
        <span key={i} className="absolute" style={{ top: `${f.top}%`, left: `${f.left}%`, perspective: "600px", animation: `bob ${5 + (i % 4)}s ease-in-out ${i * 0.4}s infinite` }}>
          <span ref={(el) => void (refs.current[i] = el)} className="block" style={{ transformStyle: "preserve-3d" }}>
            {f.kind === "brick" ? (
              <Brick size={f.s} color={BRICK_COLORS[f.c]} style={{ position: "relative" }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/scenes/${f.src}.png`} alt="" width={f.w} height={f.w} className="block opacity-95 drop-shadow-[0_14px_18px_rgba(0,0,0,0.12)]" />
            )}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ---------------- World-builder loader ---------------- */

const LOADER_BRICKS: { x: number; y: number; c: number }[] = [
  // A little house, built from the ground up.
  { x: 0, y: 0, c: 3 }, { x: 1, y: 0, c: 3 }, { x: 2, y: 0, c: 3 }, { x: 3, y: 0, c: 3 },
  { x: 0, y: 1, c: 2 }, { x: 1, y: 1, c: 2 }, { x: 2, y: 1, c: 2 }, { x: 3, y: 1, c: 2 },
  { x: 0, y: 2, c: 2 }, { x: 1, y: 2, c: 1 }, { x: 2, y: 2, c: 2 }, { x: 3, y: 2, c: 2 },
  { x: 0.5, y: 3, c: 0 }, { x: 1.5, y: 3, c: 0 }, { x: 2.5, y: 3, c: 0 },
  { x: 1, y: 4, c: 0 }, { x: 2, y: 4, c: 0 },
  { x: 1.5, y: 5, c: 4 },
];
const LOADER_KEY = "imw:loaded";

/**
 * Bricks drop in and build a little house while the page loads, then the
 * screen splits open onto the site. Once per session; skipped for reduced
 * motion. Click to skip.
 */
export function WorldLoader() {
  const [state, setState] = useState<"hidden" | "building" | "opening">("hidden");
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(LOADER_KEY) === "1";
      sessionStorage.setItem(LOADER_KEY, "1");
    } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setState("building");
    const minTime = new Promise((r) => setTimeout(r, LOADER_BRICKS.length * 70 + 650));
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => window.addEventListener("load", r, { once: true }));
    const cap = new Promise((r) => setTimeout(r, 3500));
    let cancelled = false;
    void Promise.race([Promise.all([minTime, loaded]), cap]).then(() => {
      if (cancelled) return;
      setState("opening");
      setTimeout(() => !cancelled && setState("hidden"), 750);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (state === "hidden") return null;
  const S = 34;
  const open = state === "opening";
  return (
    <div className="fixed inset-0 z-[100]" onClick={() => setState("hidden")} role="status" aria-label="Loading In My World">
      <div className="absolute inset-x-0 top-0 h-1/2 bg-[#3fb6f5]" style={open ? { animation: "split-up 0.7s cubic-bezier(.7,0,.2,1) forwards" } : undefined} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#7fd14f]" style={open ? { animation: "split-down 0.7s cubic-bezier(.7,0,.2,1) forwards" } : undefined} />
      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${open ? "opacity-0" : "opacity-100"}`}>
        <div className="relative" style={{ width: S * 4 * 2, height: S * 6, perspective: "800px" }}>
          {LOADER_BRICKS.map((b, i) => (
            <span
              key={i}
              className="absolute"
              style={{ left: b.x * S * 2, bottom: b.y * S, width: S * 2, height: S, animation: `drop-in 0.5s cubic-bezier(.3,1.4,.5,1) ${i * 0.07}s both` }}
            >
              <span className="block" style={{ transform: "rotateX(-22deg) rotateY(18deg)", transformStyle: "preserve-3d" }}>
                <Brick size={S} color={BRICK_COLORS[b.c]} style={{ position: "relative" }} />
              </span>
            </span>
          ))}
        </div>
        <p className="mt-10 font-mono text-small text-[#0b3a5c]">building your world…</p>
      </div>
    </div>
  );
}

/* ---------------- Character in a brick ---------------- */

/**
 * An inline brick with a character peeking out. Hover (or tap) and they pop
 * out, wave, and drop back in.
 */
export function PopChip({ id }: { id: string }) {
  const c = OFFICIAL_CHARACTERS.find((x) => x.id === id) ?? OFFICIAL_CHARACTERS[0];
  const [out, setOut] = useState(false);
  return (
    <span
      className="relative mx-[0.12em] inline-block h-[0.82em] w-[1em] translate-y-[0.08em] cursor-pointer align-baseline"
      onMouseEnter={() => setOut(true)}
      onMouseLeave={() => setOut(false)}
      onClick={() => setOut((o) => !o)}
      aria-label={c.name}
      role="img"
    >
      {/* The character, mostly hidden inside the brick until it pops out. */}
      <span
        className="absolute bottom-[0.35em] left-1/2 h-[1.25em] w-[1em] transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)]"
        style={{ transform: out ? "translate(-50%, -0.1em) scale(1.08)" : "translate(-50%, 0.72em) scale(0.92)" }}
      >
        <Portrait appearance={c.appearance} full pose={out ? "wave" : "idle"} className="h-full w-full" />
      </span>
      {/* The brick (front face drawn over the character's legs). */}
      <span className="absolute inset-x-0 bottom-0 h-[0.5em] rounded-[0.08em]" style={{ background: BRICK_COLORS[c.name.length % BRICK_COLORS.length], boxShadow: "inset 0 -0.06em 0 rgba(0,0,0,0.18)" }}>
        <span className="absolute -top-[0.09em] left-[0.18em] h-[0.1em] w-[0.22em] rounded-t-[0.04em] bg-inherit brightness-110" style={{ background: "inherit" }} />
        <span className="absolute -top-[0.09em] right-[0.18em] h-[0.1em] w-[0.22em] rounded-t-[0.04em]" style={{ background: "inherit" }} />
      </span>
    </span>
  );
}

/* ---------------- Pinned horizontal scroller ---------------- */

/**
 * On wide screens the section pins and vertical scrolling moves the cards
 * sideways. On small screens it's a normal swipeable row.
 */
export function HorizontalScroll({ children, header }: { children: ReactNode; header: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const measure = () => {
      const t = track.current, p = pin.current;
      if (!t || !p || !mq.matches) return setLayout(null);
      const travel = Math.max(0, t.scrollWidth - t.clientWidth);
      const content = p.offsetHeight;
      // Pin vertically centred under the sticky nav; the section is only as tall as it needs to be.
      setLayout({ height: content + travel, top: Math.max(96, (window.innerHeight - content) / 2 + 30) });
    };
    measure();
    window.addEventListener("resize", measure);
    mq.addEventListener("change", measure);
    return () => {
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
    };
  }, []);

  useEffect(() => {
    const t = track.current;
    if (!layout || !t) {
      if (t) t.style.transform = "";
      return;
    }
    let raf = 0;
    const tick = () => {
      raf = 0;
      const w = wrap.current;
      if (!w) return;
      const travel = Math.max(0, t.scrollWidth - t.clientWidth);
      const p = Math.min(1, Math.max(0, (layout.top - w.getBoundingClientRect().top) / Math.max(1, travel)));
      t.style.transform = `translate3d(${-p * travel}px,0,0)`;
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [layout]);

  return (
    <div ref={wrap} style={layout ? { height: layout.height } : undefined} className="relative">
      <div ref={pin} className={layout ? "sticky overflow-hidden" : ""} style={layout ? { top: layout.top } : undefined}>
        {header}
        <div ref={track} className={`flex gap-4 ${layout ? "will-change-transform" : "snap-x snap-mandatory overflow-x-auto pb-4 scrollbar-none"}`}>
          {children}
          <span aria-hidden className="w-px shrink-0" />
        </div>
      </div>
    </div>
  );
}

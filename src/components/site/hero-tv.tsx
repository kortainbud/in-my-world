"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import { buildAvatar } from "@/lib/render/avatar";
import { TEMPLATES } from "@/config/site";
import { api } from "@/lib/client/api";

/**
 * A live 3D character that waves on its own every few seconds, and keeps
 * waving while you hover. Only animates while on screen.
 */
export function WavingCharacter({ id = "ch_milo", className = "" }: { id?: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const hover = useRef(false);
  useEffect(() => {
    const el = host.current!;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(r.domElement);
    r.domElement.style.width = "100%";
    r.domElement.style.height = "100%";
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#6a6060", 1.7));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(4, 8, 9);
    scene.add(key);
    const c = OFFICIAL_CHARACTERS.find((x) => x.id === id) ?? OFFICIAL_CHARACTERS[0];
    const av = buildAvatar(c.appearance, "roblox");
    scene.add(av.root);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      r.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      cam.position.set(0, av.topY * 0.55, av.topY * 2.15);
      cam.lookAt(0, av.topY * 0.5, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    let raf = 0;
    let mouseX = 0;
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      mouseX = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / 500));
    };
    window.addEventListener("pointermove", onMove);
    const t0 = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const t = (performance.now() - t0) / 1000;
      const cycle = t % 4.5;
      const waving = hover.current || (cycle > 2.6 && cycle < 4.3);
      av.body.position.y = Math.sin(t * 2.2) * 0.04;
      av.root.rotation.y += ((-0.25 + mouseX * 0.5) - av.root.rotation.y) * 0.08;
      av.head.rotation.y = mouseX * 0.25;
      av.armL.rotation.z = -0.08;
      const target = waving && !reduce ? 2.75 + Math.sin(t * 11) * 0.35 : 0.1;
      av.armR.rotation.z += (target - av.armR.rotation.z) * 0.18;
      av.setExpression(waving ? "happy" : "neutral");
      r.render(scene, cam);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      av.dispose();
      r.dispose();
      r.domElement.remove();
    };
  }, [id]);
  return (
    <div
      ref={host}
      className={className}
      onPointerEnter={() => (hover.current = true)}
      onPointerLeave={() => (hover.current = false)}
      role="img"
      aria-label="A blocky character waving"
    />
  );
}

const IDEAS = TEMPLATES.map((t) => t.prompt);

/** A blocky TV whose screen is the prompt box. */
export function HeroTV() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [idea, setIdea] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    api<{ user: unknown }>("/api/me").then((d) => setSignedIn(!!d.user)).catch(() => undefined);
    const t = setInterval(() => setIdea((i) => (i + 1) % IDEAS.length), 3200);
    return () => clearInterval(t);
  }, []);
  const go = (prompt: string) => {
    const p = prompt.trim();
    const dest = `/studio${p ? `?prompt=${encodeURIComponent(p)}` : ""}`;
    router.push(signedIn ? dest : `/sign-up?next=${encodeURIComponent(dest)}`);
  };
  return (
    <div className="relative mx-auto w-full max-w-[600px] pt-10">
      {/* antennas */}
      <span aria-hidden className="absolute left-[38%] top-0 h-14 w-1.5 origin-bottom -rotate-[24deg] rounded-full bg-[#2a2a30]">
        <span className="absolute -left-1.5 -top-2 h-4 w-4 rounded-[3px] bg-[#e63946]" />
      </span>
      <span aria-hidden className="absolute left-[56%] top-1 h-12 w-1.5 origin-bottom rotate-[20deg] rounded-full bg-[#2a2a30]">
        <span className="absolute -left-1.5 -top-2 h-4 w-4 rounded-[3px] bg-[#f5c518]" />
      </span>
      {/* body */}
      <div className="relative rounded-[30px] bg-[#3d7bf2] p-3.5 shadow-[0_30px_60px_-30px_rgba(20,40,120,0.6),inset_0_-8px_0_rgba(0,0,0,0.18),inset_0_4px_0_rgba(255,255,255,0.25)] sm:p-4">
        {/* studs */}
        <div aria-hidden className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-3 w-7 rounded-t-[6px] bg-[#3d7bf2] shadow-[inset_0_2px_0_rgba(255,255,255,0.3)]" />
          ))}
        </div>
        <div className="flex gap-3 sm:gap-4">
          {/* screen */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(value);
            }}
            className="relative min-w-0 flex-1 overflow-hidden rounded-[20px] bg-[#0f1a2e] p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] sm:p-5"
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)" }} />
            <span aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-40 w-56 rotate-[-20deg] rounded-full bg-white/[0.06] blur-xl" />
            <label htmlFor="hero-prompt" className="relative block font-mono text-micro text-[#9ef0a8]">
              ● ch. 01 — what happens in your world?
            </label>
            <textarea
              id="hero-prompt"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  go(value);
                }
              }}
              rows={3}
              maxLength={600}
              placeholder={IDEAS[idea]}
              className="relative mt-2 block w-full resize-none bg-transparent text-title font-medium leading-snug text-white outline-none placeholder:text-white/40 sm:text-title"
            />
            <div className="relative mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setValue(IDEAS[idea])} className="truncate font-mono text-micro text-white/50 hover:text-white/80">
                use this idea ↵
              </button>
              <button type="submit" className="inline-flex h-10 shrink-0 items-center rounded-full bg-[#b9f36a] px-4 text-body font-semibold text-[#101010] transition-colors hover:bg-[#c9f88a]">
                create video
              </button>
            </div>
          </form>
          {/* side panel: knobs + speaker */}
          <div aria-hidden className="hidden w-14 shrink-0 flex-col items-center justify-between rounded-[16px] bg-[#2f66d6] py-4 sm:flex">
            <span className="h-8 w-8 rounded-full bg-[#f5c518] shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]" />
            <span className="h-8 w-8 rounded-full bg-[#e63946] shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)]" />
            <span className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#1d4fb0]" />
              ))}
            </span>
          </div>
        </div>
      </div>
      {/* feet */}
      <div aria-hidden className="flex justify-between px-14">
        <span className="h-4 w-10 rounded-b-[6px] bg-[#2a2a30]" />
        <span className="h-4 w-10 rounded-b-[6px] bg-[#2a2a30]" />
      </div>
    </div>
  );
}

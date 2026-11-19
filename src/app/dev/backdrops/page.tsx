"use client";
/**
 * Development only: renders the marketing site's scene illustrations with the
 * engine (voxel skies, landscapes, the cast line-up) so they can be saved to
 * public/scenes. Run via puppeteer; see scripts in the README.
 */
import { useEffect, useState } from "react";
import * as THREE from "three";
import { makeKit } from "@/lib/render/kit";
import { buildAvatar } from "@/lib/render/avatar";
import { OFFICIAL_CHARACTERS } from "@/lib/engine/characters";
import { rng } from "@/lib/engine/rng";
import type { VisualStyle } from "@/lib/engine/types";

type Spec = { name: string; w: number; h: number; style: VisualStyle; kind: "hills" | "ocean" | "lineup" | "meadow" | "night" | "sunset" | "island" | "finale"; clouds?: "all" | "edges" | "none"; dark?: boolean; transparent?: boolean };

const SPECS: Spec[] = [
  { name: "hero", w: 2560, h: 1300, style: "minecraft", kind: "hills" },
  { name: "ocean", w: 2400, h: 1100, style: "minecraft", kind: "ocean" },
  { name: "lineup", w: 2400, h: 1000, style: "roblox", kind: "lineup" },
  { name: "cta", w: 2560, h: 1100, style: "minecraft", kind: "meadow", clouds: "edges" },
  { name: "card-day", w: 900, h: 420, style: "minecraft", kind: "hills" },
  { name: "card-night", w: 900, h: 420, style: "minecraft", kind: "night" },
  { name: "card-sunset", w: 900, h: 420, style: "minecraft", kind: "sunset" },
  { name: "footer", w: 2560, h: 520, style: "minecraft", kind: "ocean", clouds: "none" },
  { name: "island", w: 1800, h: 1100, style: "minecraft", kind: "island", transparent: true, clouds: "none" },
  { name: "island-night", w: 1800, h: 1100, style: "minecraft", kind: "island", transparent: true, clouds: "none", dark: true },
  { name: "finale", w: 2560, h: 1800, style: "minecraft", kind: "finale", clouds: "edges" },
  { name: "finale-night", w: 2560, h: 1800, style: "minecraft", kind: "finale", clouds: "none", dark: true },
  { name: "lineup-night", w: 2400, h: 1000, style: "roblox", kind: "lineup", dark: true, clouds: "none" },
];

function render(spec: Spec): string {
  const canvas = document.createElement("canvas");
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: !!spec.transparent });
  r.setPixelRatio(1);
  r.setSize(spec.w, spec.h, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.08;
  r.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const k = makeKit(spec.style);
  const rand = rng(spec.name.length * 97 + spec.w);
  const night = spec.kind === "night" || !!spec.dark;
  const sunset = spec.kind === "sunset";
  const skyColor = new THREE.Color(night ? "#121a3d" : sunset ? "#ff9e6b" : "#3fb6f5");
  if (!spec.transparent) {
    scene.background = skyColor;
    scene.fog = new THREE.Fog(skyColor, 90, 320);
  }
  scene.add(new THREE.HemisphereLight(night ? "#8fa2ff" : "#e9f6ff", "#6c8a4a", night ? 1.3 : 1.6));
  const sun = new THREE.DirectionalLight(sunset ? "#ffd2a8" : "#fff6e6", night ? 0.8 : 2.4);
  sun.position.set(30, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 200 });
  scene.add(sun);
  const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, pat: Parameters<typeof k.box>[4] = "noise", o?: Parameters<typeof k.box>[5]) => {
    const m = k.box(w, h, d, c, pat, o);
    m.position.set(x, y + h / 2, z);
    scene.add(m);
    return m;
  };
  const cloud = (x: number, y: number, z: number, s: number) => {
    const c = night ? "#c9d2ff" : "#ffffff";
    box(6 * s, 1.2 * s, 3 * s, c, x, y, z, "plain");
    box(3.6 * s, 1.2 * s, 2.6 * s, c, x - 0.6 * s, y + 1.2 * s, z, "plain");
    box(2.4 * s, 1 * s, 2 * s, night ? "#aab4f0" : "#ffe1ef", x + 1.5 * s, y - 0.6 * s, z, "plain");
  };
  for (let i = 0; i < 8; i++) {
    const x = -80 + i * 23 + rand.next() * 8;
    if (spec.clouds === "none" || (spec.clouds === "edges" && Math.abs(x) < 48)) continue;
    cloud(x, 17 + rand.next() * 9, -55 - rand.next() * 15, 1.5 + rand.next() * 1.1);
  }
  if (night) {
    const moon = box(7, 7, 7, "#f6f2dc", 30, 34, -110, "noise", { emissive: "#f6f2dc", emissiveIntensity: 0.9 });
    void moon;
    for (let i = 0; i < 60; i++) box(0.5, 0.5, 0.5, "#ffffff", -120 + rand.next() * 240, 25 + rand.next() * 50, -140, "plain", { emissive: "#ffffff", emissiveIntensity: 1 });
  }

  const camera = new THREE.PerspectiveCamera(spec.kind === "lineup" ? 26 : 38, spec.w / spec.h, 0.1, 500);

  if (spec.kind === "island") {
    // A floating voxel island: grass top, dirt, a tapering stone underside.
    const R = 7;
    for (let x = -R; x <= R; x++)
      for (let z = -R; z <= R; z++) {
        const d = Math.hypot(x, z * 1.15);
        if (d > R + 0.3) continue;
        box(1, 1, 1, night ? "#3d7a35" : "#6cc04a", x, 0, z, "grass");
        const depth = Math.max(1, Math.round((R - d) * 0.9 + rand.next() * 1.5));
        for (let y = 1; y <= depth; y++) box(1, 1, 1, y < 3 ? "#8a5a36" : "#8a8f96", x, -y, z, y < 3 ? "noise" : "stone");
      }
    box(1, 4, 1, "#7a5232", -3, 1, -2, "bark");
    box(4, 3, 4, night ? "#245c2c" : "#2f9a44", -3, 4, -2, "leaves");
    box(1, 3, 1, "#7a5232", 4, 1, 3, "bark");
    box(3, 2, 3, night ? "#245c2c" : "#3fae4a", 4, 3.5, 3, "leaves");
    box(4, 3, 3.5, "#f2d1a5", 1.5, 1, -3.5, "planks");
    box(4.6, 0.8, 4.2, "#b23a2b", 1.5, 4, -3.5, "planks");
    box(1, 1, 0.1, night ? "#ffd27a" : "#bfe6ff", 0.6, 2, -1.7, "glass", night ? { emissive: "#ffd27a", emissiveIntensity: 1.2 } : undefined);
    for (let i = 0; i < 10; i++) box(0.5, 0.5, 0.5, rand.pick(["#ff8fb1", "#ffd166", "#ffffff"]), -5 + rand.next() * 10, 1, -5 + rand.next() * 10, "plain");
    const av = buildAvatar(OFFICIAL_CHARACTERS[0].appearance, "minecraft");
    av.root.scale.setScalar(0.42);
    av.root.position.set(-1, 1, 3.5);
    av.armR.rotation.z = 2.6;
    scene.add(av.root);
    camera.fov = 30;
    camera.position.set(22, 18, 30);
    camera.lookAt(0, -1.5, 0);
    camera.updateProjectionMatrix();
  } else if (spec.kind === "finale") {
    // Sky, sea, and a beach that runs to the bottom of the image (the footer sits on the sand).
    box(400, 2, 160, night ? "#1d3f86" : "#2f8ef0", 0, -2, -110, "water");
    box(400, 2, 140, night ? "#6d6450" : "#f3dd8f", 0, -1.6, 40, "sand");
    for (let i = 0; i < 30; i++) box(4 + rand.next() * 6, 0.2, 0.6, night ? "#5c7fd0" : "#bfe6ff", -120 + rand.next() * 240, 0.05, -40 - rand.next() * 60, "plain");
    if (night) box(8, 8, 8, "#f6f2dc", -40, 30, -150, "noise", { emissive: "#f6f2dc", emissiveIntensity: 0.9 });
    for (const [x, z, c] of [[-40, -55, "#ffffff"], [30, -70, "#ffd0e4"], [58, -45, "#ffffff"]] as const) {
      box(10, 2, 4, "#f5f3ee", x, 0, z, "planks");
      box(0.5, 12, 0.5, "#7a5232", x, 2, z, "bark");
      box(0.4, 8, 6, c, x + 0.5, 4, z, "fabric");
    }
    for (let i = 0; i < 18; i++) box(0.8, 0.5, 0.8, night ? "#8a8070" : "#e9c46a", -60 + rand.next() * 120, 0, -5 + rand.next() * 30, "sand");
    camera.position.set(0, 14, 40);
    camera.lookAt(0, 2, -30);
  } else if (spec.kind === "ocean") {
    box(400, 2, 140, "#2f8ef0", 0, -2, -70, "water");
    box(400, 2, 18, "#f3dd8f", 0, -1.6, 14, "sand");
    for (let i = 0; i < 40; i++) box(4 + rand.next() * 6, 0.2, 0.6, "#bfe6ff", -120 + rand.next() * 240, 0.05, -10 - rand.next() * 90, "plain");
    const boat = (x: number, z: number, sail: string, s = 1.8) => {
      box(6 * s, 1.2 * s, 2.4 * s, "#f5f3ee", x, 0, z, "planks");
      box(1.2 * s, 0.6 * s, 2.5 * s, "#ffd166", x, 1.2 * s, z, "plain");
      box(0.3 * s, 7 * s, 0.3 * s, "#7a5232", x, 1.2 * s, z, "bark");
      box(0.25 * s, 5 * s, 3.5 * s, sail, x + 0.3 * s, 2.5 * s, z, "fabric");
    };
    boat(-34, -28, "#ffffff");
    boat(14, -38, "#ffd0e4", 1.5);
    boat(42, -22, "#ffffff", 1.9);
    camera.position.set(0, 9, 40);
    camera.lookAt(0, 4, -40);
  } else if (spec.kind === "lineup") {
    box(200, 2, 80, "#6cc04a", 0, -2, 0, "grass");
    for (let i = 0; i < 14; i++) {
      const x = -60 + i * 9 + rand.next() * 4, z = -30 - rand.next() * 20;
      box(1.4, 6, 1.4, "#7a5232", x, 0, z, "bark");
      const leaf = k.blob(6 + rand.next() * 3, rand.pick(["#3fae4a", "#4cbb57", "#2f9a44"]));
      leaf.position.set(x, 8, z);
      scene.add(leaf);
    }
    if (night) for (let i = 0; i < 50; i++) box(0.4, 0.4, 0.4, "#ffffff", -100 + rand.next() * 200, 18 + rand.next() * 40, -120, "plain", { emissive: "#ffffff", emissiveIntensity: 1 });
    OFFICIAL_CHARACTERS.forEach((c, i) => {
      const av = buildAvatar(c.appearance, spec.style);
      av.setExpression("happy");
      if (i % 3 === 0) av.armR.rotation.z = 2.6;
      if (i % 3 === 1) {
        av.armL.rotation.z = -2.7;
        av.armR.rotation.z = 2.7;
      }
      av.root.position.set((i - (OFFICIAL_CHARACTERS.length - 1) / 2) * 3.4, 0, i % 2 ? -0.8 : 0.6);
      av.root.rotation.y = (i - 4) * -0.04;
      scene.add(av.root);
    });
    camera.position.set(0, 4.5, 40);
    camera.lookAt(0, 3.2, 0);
  } else {
    // Rolling block hills.
    const base = spec.kind === "meadow" ? "#7fd14f" : "#5fbf3f";
    box(400, 2, 260, base, 0, -2, -80, "grass");
    for (let row = 0; row < 5; row++) {
      for (let i = -14; i <= 14; i++) {
        const h = 2 + Math.round(Math.max(0, Math.sin(i * 0.35 + row * 1.7) * 6 + rand.next() * 3));
        box(10, h, 10, row % 2 ? "#4ea838" : base, i * 10, 0, -40 - row * 22, "grass");
      }
    }
    for (let i = 0; i < 24; i++) {
      const x = -90 + rand.next() * 180, z = -20 - rand.next() * 60;
      box(1.2, 4, 1.2, "#7a5232", x, 0, z, "bark");
      box(5, 4, 5, rand.pick(["#2f9a44", "#3fae4a"]), x, 4, z, "leaves");
    }
    for (let i = 0; i < 30; i++) box(0.8, 0.8, 0.8, rand.pick(["#ff8fb1", "#ffd166", "#ffffff", "#b28dff"]), -50 + rand.next() * 100, 0, 6 - rand.next() * 20, "plain");
    if (spec.kind !== "meadow") {
      for (const [x, z, c] of [[-26, -26, "#f2d1a5"], [-14, -30, "#cfe3f2"], [18, -28, "#f5c2c2"]] as const) {
        box(7, 5, 6, c, x, 0, z, "planks");
        box(8, 1.2, 7, "#b23a2b", x, 5, z, "planks");
        box(6, 1, 5, "#b23a2b", x, 6.2, z, "planks");
        box(1.4, 1.6, 0.1, night ? "#ffd27a" : "#bfe6ff", x - 1.5, 2, z + 3.02, "glass", night ? { emissive: "#ffd27a", emissiveIntensity: 1 } : undefined);
      }
    }
    camera.position.set(0, 10, 36);
    camera.lookAt(0, 6, -40);
  }
  r.render(scene, camera);
  const url = canvas.toDataURL("image/png");
  r.dispose();
  r.forceContextLoss();
  return url;
}

export default function Backdrops() {
  const [shots, setShots] = useState<{ name: string; url: string }[]>([]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const out = SPECS.map((s) => ({ name: s.name, url: render(s) }));
    (window as unknown as { __shots: typeof out }).__shots = out;
    setShots(out);
  }, []);
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div style={{ padding: 16, display: "grid", gap: 12, background: "#fff" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {shots.map((s) => <img key={s.name} src={s.url} alt={s.name} style={{ width: "100%", maxWidth: 1200 }} />)}
    </div>
  );
}

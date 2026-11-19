/**
 * TimelineRenderer — draws any moment of a compiled Timeline into a 2D canvas:
 * the 3D scene (Three.js) plus captions, speech bubbles, overhead labels,
 * transitions and watermark. Deterministic: renderAt(t) always draws the same
 * frame, which is what lets us encode frame-by-frame.
 */
import * as THREE from "three";
import type { CameraMove, CharacterSpec, StagePosition, Timeline, TimelineScene } from "@/lib/engine/types";
import { sceneAt } from "@/lib/engine/compile";
import { rng } from "@/lib/engine/rng";
import { buildAvatar, type Avatar } from "./avatar";
import { ease, pose } from "./animate";
import { buildProps, type PropSet } from "./props";
import { buildWorld, type World } from "./world";

export const CAPTION_FONT = "ImwCaption";
let fontPromise: Promise<void> | null = null;
export function loadCaptionFont() {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    try {
      const black = new FontFace(CAPTION_FONT, "url(/fonts/Geist-Black.woff2)", { weight: "900" });
      const bold = new FontFace(CAPTION_FONT, "url(/fonts/Geist-Bold.woff2)", { weight: "700" });
      await Promise.all([black.load(), bold.load()]);
      document.fonts.add(black);
      document.fonts.add(bold);
    } catch {
      /* fall back to system sans */
    }
  })();
  return fontPromise;
}

const POS: Record<StagePosition, [number, number]> = {
  left: [-2.2, 0.6],
  center: [0, 1.2],
  right: [2.2, 0.6],
  back_left: [-3.2, -2.4],
  back_right: [3.2, -2.4],
};

interface ActiveScene {
  index: number;
  world: World;
  props: PropSet;
  placed: { ref: string; av: Avatar; base: THREE.Vector3; phase: number }[];
  scale: Record<string, [number, number]>;
}

export class TimelineRenderer {
  readonly tl: Timeline;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private fill = new THREE.DirectionalLight("#ffffff", 0.7);
  private avatars = new Map<string, Avatar>();
  private specs = new Map<string, CharacterSpec>();
  private worlds = new Map<string, World>();
  private active: ActiveScene | null = null;
  private scaleTrack: Record<string, [number, number]>[] = [];
  private scale: number;

  constructor(tl: Timeline, canvas: HTMLCanvasElement, opts: { pixelScale?: number } = {}) {
    this.tl = tl;
    this.canvas = canvas;
    this.scale = opts.pixelScale ?? 1;
    const W = Math.round(tl.width * this.scale);
    const H = Math.round(tl.height * this.scale);
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext("2d")!;
    const glCanvas = document.createElement("canvas");
    this.gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.gl.setPixelRatio(1);
    this.gl.setSize(W, H, false);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 400);
    this.hemi = new THREE.HemisphereLight("#ffffff", "#888888", 1.2);
    this.sun = new THREE.DirectionalLight("#ffffff", 2.2);
    this.sun.position.set(8, 16, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 18;
    sc.bottom = -18;
    sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.scene.fog = new THREE.Fog("#ffffff", 40, 110);

    for (const c of tl.cast) this.specs.set(c.id, c);

    // Scale continuity across scenes (growth stories).
    const cur: Record<string, number> = {};
    for (const s of tl.scenes) {
      const entry: Record<string, [number, number]> = {};
      for (const ch of s.plan.characters) {
        const start = cur[ch.ref] ?? 1;
        let end = ch.scaleTo ?? start;
        if (ch.scaleTo === undefined && ch.action === "grow") end = start * 1.3;
        if (ch.scaleTo === undefined && ch.action === "shrink") end = start * 0.75;
        end = Math.min(2.6, Math.max(0.5, end));
        entry[ch.ref] = [start, end];
        cur[ch.ref] = end;
      }
      this.scaleTrack.push(entry);
    }
  }

  private avatarFor(ref: string): Avatar | null {
    const id = this.tl.refs[ref];
    if (!id) return null;
    const hit = this.avatars.get(ref);
    if (hit) return hit;
    const spec = this.specs.get(id);
    if (!spec) return null;
    const av = buildAvatar(spec.appearance, this.tl.style);
    this.avatars.set(ref, av);
    return av;
  }

  private worldFor(s: TimelineScene): World {
    const key = `${s.plan.environment}|${s.plan.timeOfDay}`;
    let w = this.worlds.get(key);
    if (!w) {
      w = buildWorld(s.plan.environment, this.tl.style, s.plan.timeOfDay);
      this.worlds.set(key, w);
    }
    return w;
  }

  private enter(s: TimelineScene) {
    if (this.active) {
      this.scene.remove(this.active.world.group, this.active.props.group);
      for (const p of this.active.placed) this.scene.remove(p.av.root);
      this.active.props.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      if (this.active.props.held) this.active.props.held.removeFromParent();
    }
    const world = this.worldFor(s);
    const props = buildProps(this.tl.style, s.plan.props, { text: s.plan.propText, screenAnchor: world.screenAnchor, seed: s.seed, interior: world.interior });
    this.scene.add(world.group, props.group);
    this.scene.background = world.sky;
    (this.scene.fog as THREE.Fog).color = world.sky;
    (this.scene.fog as THREE.Fog).near = world.fogNear;
    (this.scene.fog as THREE.Fog).far = world.fogFar;
    this.sun.color = world.sunColor;
    this.sun.intensity = world.sunIntensity;
    this.hemi.color = world.hemiSky;
    this.hemi.groundColor = world.hemiGround;
    this.hemi.intensity = world.hemiIntensity;

    const used = new Map<StagePosition, number>();
    const placed: ActiveScene["placed"] = [];
    const r = rng(s.seed);
    for (const ch of s.plan.characters) {
      const av = this.avatarFor(ch.ref);
      if (!av || placed.some((p) => p.ref === ch.ref)) continue;
      const n = used.get(ch.position) ?? 0;
      used.set(ch.position, n + 1);
      const [px, pz] = POS[ch.position];
      const base = new THREE.Vector3(px + n * 1.6, 0, pz - n * 0.8);
      if (ch.action === "sleep" && s.plan.environment === "bedroom") base.set(-3.8, 0.6, -3.2);
      av.setExpression(ch.expression);
      this.scene.add(av.root);
      placed.push({ ref: ch.ref, av, base, phase: r.next() * 6 });
    }
    if (props.held) {
      const giver = s.plan.characters.find((c) => c.action === "give") ?? s.plan.characters[0];
      const g = placed.find((p) => p.ref === giver?.ref);
      if (g) {
        props.held.position.set(0, 0, 0.3);
        g.av.hand.add(props.held);
      }
    }
    this.active = { index: s.index, world, props, placed, scale: this.scaleTrack[s.index] ?? {} };
  }

  private shot(move: CameraMove, u: number, focus: THREE.Vector3, hero: THREE.Vector3, heroTop: number, seed: number) {
    const cam = this.camera;
    // Pull back when a character has grown so they stay in frame.
    const k = Math.min(2.4, Math.max(1, heroTop / 5.6));
    focus = focus.clone();
    const look = new THREE.Vector3(focus.x, 3.1 * k, focus.z);
    const e = ease(u);
    const side = seed % 2 ? 1 : -1;
    switch (move) {
      case "wide":
        cam.position.set(focus.x + side * (1.5 - 3 * e), 7, focus.z + 19 * k);
        look.y = 3.2;
        break;
      case "medium":
        cam.position.set(focus.x + side * 0.8, 4.4 * k, focus.z + (13.5 - e * 1.5) * k);
        break;
      case "close_up":
        cam.position.set(hero.x + side * 0.6, heroTop - 0.6, hero.z + (6.4 - e * 0.8) * k);
        look.set(hero.x, heroTop - 0.9, hero.z);
        break;
      case "low_angle":
        cam.position.set(focus.x + side * 1.5, 0.9, focus.z + (10.5 - e) * k);
        look.set(focus.x, Math.max(4, heroTop * 0.85), focus.z);
        break;
      case "over_shoulder":
        cam.position.set(focus.x - side * 4.2, 4.6, focus.z + 9 * k);
        look.set(focus.x + side * 1.2, 3.2, focus.z);
        break;
      case "orbit": {
        const a = side * (-0.6 + e * 1.2);
        cam.position.set(focus.x + Math.sin(a) * 14 * k, 5.2 * k, focus.z + Math.cos(a) * 14 * k);
        break;
      }
      case "dolly_in":
        cam.position.set(focus.x, 4.2 + (1 - e) * 1.5, focus.z + (19 - e * 9) * k);
        look.y = 3 + e * 0.6;
        break;
      case "pan":
        cam.position.set(focus.x + side * (-4 + e * 8), 4.4, focus.z + 14 * k);
        look.x = focus.x + side * (-2 + e * 4);
        break;
      case "top_down":
        cam.position.set(focus.x, 17 - e * 3, focus.z + 9 * k);
        look.set(focus.x, 1, focus.z - 1);
        break;
    }
    cam.lookAt(look);
  }

  /** Draws the frame at time t (seconds). */
  renderAt(t: number) {
    const s = sceneAt(this.tl, t);
    if (!this.active || this.active.index !== s.index) this.enter(s);
    const a = this.active!;
    const lt = t - s.start;
    const u = Math.min(1, Math.max(0, lt / s.duration));

    a.world.update(t);
    a.props.update(t, lt);

    const dlg = s.plan.dialogue;
    const inDialogue = !!(s.dialogueWindow && t >= s.dialogueWindow.start && t <= s.dialogueWindow.end);
    const inNarration = t < (s.dialogueWindow?.start ?? s.start + s.duration);
    const others = a.placed.map((p) => p.base.x);
    const focus = new THREE.Vector3();
    let heroTop = 5;
    let heroPos = new THREE.Vector3();
    a.placed.forEach((p, i) => {
      const ch = s.plan.characters.find((c) => c.ref === p.ref)!;
      const talking = (inDialogue && dlg?.ref === p.ref) || (inNarration && ch.action === "talk");
      const faceX = dlg && a.placed.length > 1 && ch.action !== "walk_across" ? others.find((x) => x !== p.base.x) : undefined;
      const res = pose(p.av, { action: ch.action, lt, dur: s.duration, t, base: p.base, phase: p.phase, talking, faceX });
      const [s0, s1] = a.scale[p.ref] ?? [1, 1];
      const grow = s0 + (s1 - s0) * ease((u - 0.15) / 0.6);
      const wobble = s0 !== s1 ? Math.sin(Math.max(0, Math.min(1, (u - 0.15) / 0.6)) * Math.PI * 3) * 0.03 : 0;
      p.av.root.scale.setScalar(grow + wobble);
      p.av.root.position.set(res.x, res.y, res.z);
      p.av.root.rotation.set(res.rx, res.ry, 0);
      if (talking) p.av.setExpression(Math.sin(t * 22) > 0 ? "shocked" : ch.expression === "shocked" ? "happy" : ch.expression);
      else p.av.setExpression(ch.expression);
      if (i === 0 || ch.position === "center") {
        heroPos = new THREE.Vector3(res.x, res.y, res.z);
        heroTop = p.av.topY * (grow + wobble) + res.y;
      }
      if (!ch.position.startsWith("back")) focus.add(new THREE.Vector3(p.base.x, 0, p.base.z));
    });
    const fg = a.placed.filter((p) => !s.plan.characters.find((c) => c.ref === p.ref)?.position.startsWith("back")).length;
    if (fg) focus.divideScalar(fg);
    if (s.plan.environment === "bedroom" && s.plan.characters.some((c) => c.action === "sleep")) focus.set(-2, 0, -1.5);
    this.shot(s.plan.camera, u, focus, heroPos, heroTop, s.seed);
    this.sun.position.set(focus.x + 8, 18, focus.z + 10);
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.fill.position.copy(this.camera.position).add(new THREE.Vector3(2, 3, 0));
    this.fill.target.position.set(focus.x, 3, focus.z);
    this.fill.intensity = s.plan.timeOfDay === "night" ? 1.1 : 0.55;

    this.gl.render(this.scene, this.camera);

    // ---- 2D composite ----
    const g = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    g.drawImage(this.gl.domElement, 0, 0);

    // Overhead labels
    for (const p of a.placed) {
      const ch = s.plan.characters.find((c) => c.ref === p.ref);
      if (!ch?.label) continue;
      const head = new THREE.Vector3();
      p.av.root.getWorldPosition(head);
      head.y += p.av.topY * p.av.root.scale.y + 0.7;
      const v = head.project(this.camera);
      if (v.z > 1) continue;
      this.pill(ch.label, ((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H, W * 0.05);
    }

    // Speech bubble
    if (inDialogue && dlg) {
      const sp = a.placed.find((p) => p.ref === dlg.ref);
      let bx = W / 2, by = H * 0.22;
      if (sp) {
        const head = new THREE.Vector3();
        sp.av.root.getWorldPosition(head);
        head.y += sp.av.topY * sp.av.root.scale.y + 1.4;
        const v = head.project(this.camera);
        if (v.z < 1) {
          bx = ((v.x + 1) / 2) * W;
          by = ((1 - v.y) / 2) * H;
        }
      }
      const pop = ease(Math.min(1, (t - s.dialogueWindow!.start) / 0.18));
      this.bubble(dlg.line, bx, Math.max(H * 0.12, Math.min(by, H * 0.5)), pop);
    }

    // Captions
    const cap = this.tl.captions.find((c) => t >= c.start && t < c.end + 0.05);
    if (cap) this.caption(cap, t);

    // Title chip (first scene)
    if (s.index === 0 && lt < 2.6) {
      const k = Math.min(1, lt / 0.3) * Math.min(1, (2.6 - lt) / 0.4);
      g.globalAlpha = k;
      this.titleChip(this.tl.title, W / 2, H * 0.085);
      g.globalAlpha = 1;
    }

    if (this.tl.watermark) {
      g.font = `700 ${Math.round(W * 0.03)}px ${CAPTION_FONT}, Arial, sans-serif`;
      g.textAlign = "right";
      g.textBaseline = "alphabetic";
      g.fillStyle = "rgba(245,243,238,0.7)";
      g.fillText("Made with In My World", W - W * 0.04, H - H * 0.025);
    }

    // Transitions: fade from black at start, quick dip between scenes, fade out at end.
    let dip = 0;
    if (t < 0.35) dip = 1 - t / 0.35;
    else if (s.index > 0 && lt < 0.16) dip = 0.7 * (1 - lt / 0.16);
    const tail = this.tl.duration - t;
    if (tail < 0.5) dip = Math.max(dip, 1 - tail / 0.5);
    if (dip > 0) {
      g.fillStyle = `rgba(16,16,16,${dip})`;
      g.fillRect(0, 0, W, H);
    }
  }

  private pill(text: string, x: number, y: number, size: number) {
    const g = this.ctx;
    g.font = `900 ${Math.round(size)}px ${CAPTION_FONT}, Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const w = g.measureText(text).width + size * 0.9;
    const h = size * 1.45;
    g.fillStyle = "rgba(16,16,16,0.88)";
    this.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    g.fill();
    g.fillStyle = "#B9F36A";
    g.fillText(text, x, y + size * 0.05);
  }

  private titleChip(text: string, x: number, y: number) {
    const g = this.ctx;
    const W = this.canvas.width;
    const size = W * 0.034;
    g.font = `700 ${Math.round(size)}px ${CAPTION_FONT}, Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const label = text.toUpperCase();
    const w = Math.min(W * 0.86, g.measureText(label).width + size * 1.6);
    const h = size * 2.1;
    g.fillStyle = "rgba(16,16,16,0.82)";
    this.roundRect(x - w / 2, y - h / 2, w, h, size * 0.4);
    g.fill();
    g.fillStyle = "#B9F36A";
    g.fillRect(x - w / 2 + size * 0.6, y - size * 0.18, size * 0.36, size * 0.36);
    g.fillStyle = "#F5F3EE";
    g.fillText(label, x + size * 0.25, y + size * 0.05, w - size * 1.8);
  }

  private bubble(text: string, x: number, y: number, pop: number) {
    const g = this.ctx;
    const W = this.canvas.width;
    const size = W * 0.046;
    g.font = `700 ${Math.round(size)}px ${CAPTION_FONT}, Arial, sans-serif`;
    const maxW = W * 0.62;
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (g.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    const tw = Math.max(...lines.map((l) => g.measureText(l).width));
    const pad = size * 0.7;
    const bw = tw + pad * 2, bh = lines.length * size * 1.25 + pad * 1.4;
    const bx = Math.min(W - bw - W * 0.04, Math.max(W * 0.04, x - bw / 2));
    const by = y - bh - size * 0.8;
    g.save();
    g.translate(x, y);
    g.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    g.translate(-x, -y);
    g.globalAlpha = pop;
    g.fillStyle = "#F5F3EE";
    this.roundRect(bx, by, bw, bh, size * 0.5);
    g.fill();
    g.beginPath();
    const tx = Math.min(bx + bw - size, Math.max(bx + size, x));
    g.moveTo(tx - size * 0.45, by + bh - 1);
    g.lineTo(tx + size * 0.45, by + bh - 1);
    g.lineTo(tx, by + bh + size * 0.7);
    g.closePath();
    g.fill();
    g.fillStyle = "#101010";
    g.textAlign = "left";
    g.textBaseline = "top";
    lines.forEach((l, i) => g.fillText(l, bx + pad, by + pad * 0.75 + i * size * 1.25));
    g.restore();
  }

  private caption(cap: Timeline["captions"][number], t: number) {
    const g = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    let size = W * 0.082;
    const words = cap.words.map((w) => w.text.toUpperCase());
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const fit = () => {
      g.font = `900 ${Math.round(size)}px ${CAPTION_FONT}, Arial, sans-serif`;
      return words.reduce((acc, w, i) => acc + g.measureText(w).width + (i ? size * 0.28 : 0), 0);
    };
    let total = fit();
    while (total > W * 0.88 && size > W * 0.045) {
      size *= 0.92;
      total = fit();
    }
    const pop = ease(Math.min(1, (t - cap.start) / 0.12));
    const y = H * 0.7;
    let x = W / 2 - total / 2;
    g.save();
    g.translate(W / 2, y);
    g.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
    g.translate(-W / 2, -y);
    g.textAlign = "left";
    cap.words.forEach((w, i) => {
      const text = words[i];
      const active = t >= w.start && t < w.end + 0.02;
      g.lineWidth = size * 0.2;
      g.strokeStyle = "#101010";
      g.strokeText(text, x, y);
      g.fillStyle = active ? "#B9F36A" : "#F5F3EE";
      g.fillText(text, x, y);
      x += g.measureText(text).width + size * 0.28;
    });
    g.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const g = this.ctx;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  dispose() {
    this.gl.dispose();
    this.gl.forceContextLoss();
    for (const av of this.avatars.values()) av.dispose();
  }
}

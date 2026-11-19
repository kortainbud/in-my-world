import * as THREE from "three";
import type { PropKind } from "@/lib/engine/types";
import { rng } from "@/lib/engine/rng";
import { buildAvatar } from "./avatar";
import { makeKit, type Kit } from "./kit";
import { defaultAppearance } from "@/lib/engine/characters";

export interface PropSet {
  group: THREE.Group;
  /** Object the "give" action attaches to the giver's hand. */
  held?: THREE.Object3D;
  update(t: number, sceneT: number): void;
}

function textTexture(text: string, w = 512, h = 288, bg = "#101010", fg = "#B9F36A") {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 72;
  const words = text.toUpperCase().split(/\s+/);
  let lines: string[] = [];
  while (size > 24) {
    g.font = `800 ${size}px Geist, Inter, Arial, sans-serif`;
    lines = [];
    let cur = "";
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (g.measureText(test).width > w - 60 && cur) {
        lines.push(cur);
        cur = word;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    if (lines.length * size * 1.1 < h - 40) break;
    size -= 6;
  }
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const glyphCache = new Map<string, THREE.SpriteMaterial>();
function glyph(ch: string, color: string) {
  const key = ch + color;
  const hit = glyphCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d")!;
  g.font = "900 104px Geist, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 10;
  g.strokeStyle = "#101010";
  g.strokeText(ch, 64, 70);
  g.fillStyle = color;
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, depthWrite: false });
  glyphCache.set(key, m);
  return m;
}

function bill(k: Kit) {
  return k.box(0.6, 0.04, 0.3, "#5cbf6a", "plain");
}

export function buildProps(
  style: Kit["style"],
  props: PropKind[],
  opts: { text?: string; screenAnchor: THREE.Vector3; seed: number; interior: boolean },
): PropSet {
  const k = makeKit(style);
  const group = new THREE.Group();
  const r = rng(opts.seed);
  const updates: ((t: number, st: number) => void)[] = [];
  let held: THREE.Object3D | undefined;
  const top = opts.interior ? 9 : 14;

  const fallers = (count: number, make: () => THREE.Object3D, speed: number, spread = 16, spin = 2) => {
    const items = Array.from({ length: count }, () => {
      const o = make();
      const data = { x: (r.next() - 0.5) * spread, z: -2 - r.next() * 8, off: r.next() * top, sp: speed * (0.7 + r.next() * 0.6), rot: r.next() * 6 };
      group.add(o);
      return { o, ...data };
    });
    updates.push((t) => {
      for (const it of items) {
        const y = top - ((t * it.sp + it.off) % top);
        it.o.position.set(it.x + Math.sin(t + it.rot) * 0.4, y, it.z);
        it.o.rotation.set(t * spin + it.rot, t * spin * 0.7, it.rot);
      }
    });
  };

  for (const p of props) {
    switch (p) {
      case "money_tree": {
        const g = new THREE.Group();
        const trunk = k.box(0.8, 3.2, 0.8, "#7a5232", "bark");
        trunk.position.y = 1.6;
        g.add(trunk);
        const crown = style === "minecraft" ? k.box(3.6, 2.4, 3.6, "#2f9a44", "leaves") : k.blob(3.4, "#3fae4a");
        crown.position.y = 4.3;
        g.add(crown);
        const bills: THREE.Mesh[] = [];
        for (let i = 0; i < 28; i++) {
          const b = bill(k);
          const a = r.next() * Math.PI * 2, rad = 1.4 + r.next() * 0.9;
          b.position.set(Math.cos(a) * rad, 3.4 + r.next() * 2.2, Math.sin(a) * rad);
          b.rotation.set(r.next(), a, r.next());
          g.add(b);
          bills.push(b);
        }
        updates.push((t) => bills.forEach((b, i) => (b.rotation.z = Math.sin(t * 3 + i) * 0.4)));
        g.position.set(3.8, 0, -5);
        group.add(g);
        break;
      }
      case "falling_money":
        fallers(36, () => bill(k), 2.2);
        break;
      case "confetti": {
        const colors = ["#B9F36A", "#ff6b8b", "#7a5cfa", "#ffd166", "#3d7bf2", "#ffffff"];
        fallers(70, () => k.box(0.22, 0.04, 0.14, colors[Math.floor(r.next() * colors.length)], "plain"), 2.6, 18, 5);
        break;
      }
      case "rain":
        fallers(120, () => k.box(0.04, 0.7, 0.04, "#a9d6ff", "plain", { transparent: true, opacity: 0.7 }), 14, 30, 0);
        break;
      case "dream_screen": {
        const g = new THREE.Group();
        const frame = k.box(6.4, 3.8, 0.3, "#151515", "plain");
        g.add(frame);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), new THREE.MeshBasicMaterial({ map: textTexture(opts.text || "DREAMING…") }));
        screen.position.z = 0.16;
        g.add(screen);
        const glow = new THREE.PointLight("#B9F36A", 8, 12);
        glow.position.z = 1.2;
        g.add(glow);
        g.position.copy(opts.screenAnchor);
        updates.push((t) => (g.position.y = opts.screenAnchor.y + Math.sin(t * 1.6) * 0.15));
        group.add(g);
        break;
      }
      case "sign": {
        const g = new THREE.Group();
        const post = k.box(0.25, 3, 0.25, "#6b4428", "planks");
        post.position.y = 1.5;
        g.add(post);
        const board = k.box(3.6, 1.8, 0.2, "#e9e4da", "planks");
        board.position.y = 3.6;
        g.add(board);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.6), new THREE.MeshBasicMaterial({ map: textTexture(opts.text || "WELCOME", 512, 240, "#e9e4da", "#151515") }));
        face.position.set(0, 3.6, 0.11);
        g.add(face);
        g.position.set(-5.5, 0, -3);
        group.add(g);
        break;
      }
      case "trophy": {
        const g = new THREE.Group();
        const gold = { emissive: "#f2c14e", emissiveIntensity: 0.25 };
        const ped = k.box(1.4, 1.2, 1.4, "#f5f3ee", "stone");
        ped.position.y = 0.6;
        g.add(ped);
        const cup = k.box(1, 1.1, 1, "#f2c14e", "plain", gold);
        cup.position.y = 2;
        g.add(cup);
        const base = k.box(0.5, 0.5, 0.5, "#f2c14e", "plain", gold);
        base.position.y = 1.4;
        g.add(base);
        g.position.set(4.5, 0, -2.5);
        updates.push((t) => (cup.rotation.y = t));
        group.add(g);
        break;
      }
      case "gift_box": {
        const g = new THREE.Group();
        g.add(k.box(0.9, 0.8, 0.9, "#7a5cfa", "plain"));
        const rib = k.box(0.95, 0.85, 0.2, "#B9F36A", "plain");
        g.add(rib);
        const rib2 = k.box(0.2, 0.85, 0.95, "#B9F36A", "plain");
        g.add(rib2);
        held = g;
        break;
      }
      case "phone": {
        const g = new THREE.Group();
        g.add(k.box(0.5, 0.9, 0.08, "#151515", "plain"));
        const scr = k.box(0.42, 0.78, 0.02, "#7fd3ff", "plain", { emissive: "#7fd3ff", emissiveIntensity: 0.8 });
        scr.position.z = 0.05;
        g.add(scr);
        held = held ?? g;
        break;
      }
      case "sparkles": {
        const sp: THREE.Sprite[] = [];
        for (let i = 0; i < 18; i++) {
          const s = new THREE.Sprite(glyph("✦", r.next() > 0.5 ? "#B9F36A" : "#ffffff"));
          s.scale.setScalar(0.7);
          group.add(s);
          sp.push(s);
        }
        updates.push((t) =>
          sp.forEach((s, i) => {
            const a = t * 0.8 + i * 0.7;
            s.position.set(Math.cos(a) * (2.5 + (i % 3)), 2 + ((t * 0.6 + i * 0.4) % 5), Math.sin(a) * 2 - 1);
            s.material.rotation = t + i;
          }),
        );
        break;
      }
      case "question_marks":
      case "hearts": {
        const sp: THREE.Sprite[] = [];
        for (let i = 0; i < 10; i++) {
          const s = new THREE.Sprite(p === "hearts" ? glyph("♥", "#ff6b8b") : glyph("?", "#B9F36A"));
          s.scale.setScalar(0.9 + r.next() * 0.6);
          group.add(s);
          sp.push(s);
        }
        const offs = sp.map(() => ({ x: (r.next() - 0.5) * 8, z: -r.next() * 4, o: r.next() * 4 }));
        updates.push((t) =>
          sp.forEach((s, i) => {
            const y = 3 + ((t * 0.9 + offs[i].o) % 5);
            s.position.set(offs[i].x + Math.sin(t * 2 + i) * 0.3, y, offs[i].z);
          }),
        );
        break;
      }
      case "car": {
        const car = new THREE.Group();
        const c1 = k.box(3.4, 1, 1.7, "#3d7bf2", "plain");
        c1.position.y = 0.85;
        car.add(c1);
        const c2 = k.box(1.9, 0.8, 1.5, "#bfe6ff", "glass");
        c2.position.set(-0.2, 1.75, 0);
        car.add(c2);
        car.position.z = -3.5;
        group.add(car);
        updates.push((_, st) => (car.position.x = -12 + st * 6));
        break;
      }
      case "crowd": {
        const colors = ["#e63946", "#3d7bf2", "#f5c518", "#2a9d8f", "#7a5cfa", "#f2643d", "#f5f3ee"];
        const skins = ["#f2c9a0", "#c68b5e", "#8d5a3b", "#e8b48f", "#6e4630"];
        const people: THREE.Group[] = [];
        for (let i = 0; i < 9; i++) {
          const ap = { ...defaultAppearance(), top: colors[i % colors.length], skin: skins[i % skins.length], hair: (["short", "bun", "spiky", "none", "curly"] as const)[i % 5], height: 0.85 + r.next() * 0.3 };
          const av = buildAvatar(ap, style);
          av.root.scale.setScalar(0.85);
          av.root.position.set(-9 + i * 2.25 + (r.next() - 0.5), 0, -6.5 - (i % 2) * 1.6);
          group.add(av.root);
          people.push(av.root);
          const phase = r.next() * 6;
          updates.push((t) => {
            av.root.position.y = Math.max(0, Math.sin(t * 7 + phase)) * 0.35;
            av.armL.rotation.z = -2.6 + Math.sin(t * 8 + phase) * 0.3;
            av.armR.rotation.z = 2.6 - Math.sin(t * 8 + phase) * 0.3;
          });
        }
        break;
      }
    }
  }

  return { group, held, update: (t, st) => updates.forEach((f) => f(t, st)) };
}

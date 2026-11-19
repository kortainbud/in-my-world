/**
 * Procedural environments. Every environment is assembled from the style kit,
 * so it exists in both visual styles.
 */
import * as THREE from "three";
import type { EnvironmentKind, TimeOfDay, VisualStyle } from "@/lib/engine/types";
import { hashString, rng } from "@/lib/engine/rng";
import { makeKit, type Kit, type Pattern } from "./kit";

export interface World {
  group: THREE.Group;
  sky: THREE.Color;
  fogNear: number;
  fogFar: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  /** Where screens/signs float for this environment. */
  screenAnchor: THREE.Vector3;
  interior: boolean;
  update(t: number): void;
}

const SKY: Record<TimeOfDay, { sky: string; sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number }> = {
  day: { sky: "#8ccfff", sun: "#fff4e0", sunI: 2.4, hemiSky: "#dff1ff", hemiGround: "#8a7a5c", hemiI: 1.25 },
  sunset: { sky: "#f4a46a", sun: "#ffc28a", sunI: 2.0, hemiSky: "#ffd2b0", hemiGround: "#5a4060", hemiI: 1.0 },
  night: { sky: "#101a3a", sun: "#b4c6ff", sunI: 1.3, hemiSky: "#7d8fd0", hemiGround: "#3a3050", hemiI: 1.5 },
};

function put<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x: number, y: number, z: number, ry = 0): T {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  parent.add(o);
  return o;
}

/** Box placed with its bottom at y. */
function block(parent: THREE.Object3D, k: Kit, w: number, h: number, d: number, color: string, x: number, y: number, z: number, pattern: Pattern = "noise", opts?: Parameters<Kit["mat"]>[2]) {
  return put(parent, k.box(w, h, d, color, pattern, opts), x, y + h / 2, z);
}

function tree(parent: THREE.Object3D, k: Kit, x: number, z: number, s = 1, leaf = "#3fae4a") {
  const g = new THREE.Group();
  block(g, k, 0.7 * s, 2.6 * s, 0.7 * s, "#7a5232", 0, 0, 0, "bark");
  if (k.style === "minecraft") {
    block(g, k, 3 * s, 2 * s, 3 * s, leaf, 0, 2.4 * s, 0, "leaves");
    block(g, k, 2 * s, 1 * s, 2 * s, leaf, 0, 4.4 * s, 0, "leaves");
  } else {
    put(g, k.blob(2.8 * s, leaf), 0, 3.6 * s, 0);
    put(g, k.blob(1.9 * s, leaf), 0.7 * s, 4.6 * s, 0.2 * s);
  }
  put(parent, g, x, 0, z);
  return g;
}

function house(parent: THREE.Object3D, k: Kit, x: number, z: number, wall: string, roof: string, night: boolean, w = 6, h = 4.5) {
  const g = new THREE.Group();
  block(g, k, w, h, 4, wall, 0, 0, 0, k.style === "minecraft" ? "planks" : "noise");
  if (k.style === "minecraft") {
    block(g, k, w + 1, 1, 5, roof, 0, h, 0, "planks");
    block(g, k, w - 1, 1, 4, roof, 0, h + 1, 0, "planks");
  } else {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.4, 2.2, 4, 1), k.mat(roof, "plain"));
    r.rotation.y = Math.PI / 4;
    r.scale.set(w / 4.2, 1, 1.05);
    r.castShadow = true;
    put(g, r, 0, h + 1.1, 0);
  }
  block(g, k, 1.2, 2.2, 0.1, "#6b4428", 0, 0, 2.02, "planks");
  const glow = night ? { emissive: "#ffd27a", emissiveIntensity: 0.9 } : undefined;
  block(g, k, 1.2, 1.1, 0.1, night ? "#ffd27a" : "#bfe6ff", -w / 2 + 1.2, 1.6, 2.02, "glass", glow);
  block(g, k, 1.2, 1.1, 0.1, night ? "#ffd27a" : "#bfe6ff", w / 2 - 1.2, 1.6, 2.02, "glass", glow);
  put(parent, g, x, 0, z);
  return g;
}

function tower(parent: THREE.Object3D, k: Kit, x: number, z: number, w: number, h: number, color: string, night: boolean, seed: number) {
  const g = new THREE.Group();
  block(g, k, w, h, w, color, 0, 0, 0, k.style === "minecraft" ? "stone" : "noise");
  const r = rng(seed);
  const winColor = night ? "#ffe39a" : "#cfe9ff";
  for (let y = 1.2; y < h - 0.8; y += 1.6)
    for (let i = 0; i < Math.floor(w / 1.4); i++) {
      if (night && r.next() < 0.45) continue;
      block(g, k, 0.8, 0.9, 0.08, winColor, -w / 2 + 0.9 + i * 1.4, y, w / 2 + 0.02, "glass", night ? { emissive: winColor, emissiveIntensity: 0.8 } : undefined);
    }
  put(parent, g, x, 0, z);
  return g;
}

function lamp(parent: THREE.Object3D, k: Kit, x: number, z: number, night: boolean) {
  block(parent, k, 0.25, 4.2, 0.25, "#3a3a3a", x, 0, z, "plain");
  block(parent, k, 0.7, 0.45, 0.7, night ? "#ffe2a0" : "#f5f3ee", x, 4.2, z, "plain", night ? { emissive: "#ffd27a", emissiveIntensity: 1.2 } : undefined);
}

function ground(parent: THREE.Object3D, k: Kit, color: string, pattern: Pattern, size = 90) {
  const g = k.box(size, 1, size, color, pattern);
  g.position.set(0, -0.5, 0);
  g.castShadow = false;
  parent.add(g);
  return g;
}

export function buildWorld(env: EnvironmentKind, style: VisualStyle, time: TimeOfDay, seed = 1): World {
  const k = makeKit(style);
  const group = new THREE.Group();
  const night = time === "night";
  const sky = SKY[time];
  const r = rng(hashString(env + style) + seed);
  const animated: ((t: number) => void)[] = [];
  let interior = false;
  const screenAnchor = new THREE.Vector3(0, 7.2, -3);
  const voxel = style === "minecraft";

  switch (env) {
    case "town_street": {
      ground(group, k, voxel ? "#5fa83f" : "#79c25a", "grass");
      block(group, k, 90, 0.06, 7, "#d9d4c8", 0, 0, 0.5, "tiles"); // sidewalk
      block(group, k, 90, 0.04, 5, "#3b3d44", 0, 0, -5.5, "stone"); // road
      for (let x = -40; x < 40; x += 4) block(group, k, 1.6, 0.05, 0.2, "#f5f3ee", x, 0.03, -5.5, "plain");
      const walls = ["#f2d1a5", "#cfe3f2", "#f5c2c2", "#d7f2c2", "#efe6ff"];
      const roofs = ["#c0392b", "#34495e", "#8e5a3a", "#2e7d5b"];
      for (let i = -3; i <= 3; i++) house(group, k, i * 8, -13, walls[(i + 3) % walls.length], roofs[(i + 7) % roofs.length], night);
      for (const x of [-9, -3, 9, 15]) lamp(group, k, x, 3.2, night);
      tree(group, k, -14, 2.5, 1.1);
      tree(group, k, 13, 3.5, 0.9);
      // A car loops along the road.
      const car = new THREE.Group();
      block(car, k, 3.4, 1, 1.7, "#e63946", 0, 0.35, 0, "plain");
      block(car, k, 1.9, 0.8, 1.5, "#bfe6ff", -0.2, 1.35, 0, "glass");
      for (const [cx, cz] of [[-1.1, 0.85], [1.1, 0.85], [-1.1, -0.85], [1.1, -0.85]]) block(car, k, 0.7, 0.7, 0.25, "#1a1a1a", cx, 0, cz, "plain");
      group.add(car);
      car.position.z = -6.4;
      animated.push((t) => {
        car.position.x = ((t * 7) % 70) - 35;
      });
      break;
    }
    case "park": {
      ground(group, k, voxel ? "#5fa83f" : "#7dcf5e", "grass");
      block(group, k, 3.2, 0.05, 60, "#d8c39a", 0, 0, -20, "sand");
      block(group, k, 9, 0.12, 5, voxel ? "#3f76e4" : "#4aa8e8", -9, 0, -9, "water");
      for (let i = 0; i < 9; i++) tree(group, k, (r.next() - 0.5) * 40, -10 - r.next() * 14, 0.8 + r.next() * 0.5, r.pick(["#3fae4a", "#4cbb57", "#2f9a44"]));
      tree(group, k, -11, 0, 1.2);
      tree(group, k, 12, -2, 1);
      // bench
      block(group, k, 3.4, 0.25, 1, "#a0673a", 6, 1, -3.5, "planks");
      block(group, k, 3.4, 0.9, 0.2, "#a0673a", 6, 1.25, -4, "planks");
      block(group, k, 0.25, 1, 0.8, "#3a3a3a", 4.6, 0, -3.5, "plain");
      block(group, k, 0.25, 1, 0.8, "#3a3a3a", 7.4, 0, -3.5, "plain");
      for (let i = 0; i < 26; i++) {
        const c = r.pick(["#ff6b8b", "#ffd166", "#ffffff", "#b28dff"]);
        block(group, k, 0.3, 0.4, 0.3, c, (r.next() - 0.5) * 30, 0, -2 - r.next() * 12, "plain");
      }
      lamp(group, k, -5, -4, night);
      break;
    }
    case "bedroom": {
      interior = true;
      block(group, k, 16, 0.2, 12, "#b07a4a", 0, -0.2, -1, "planks");
      block(group, k, 16, 10, 0.4, voxel ? "#c9b8f5" : "#d8ccff", 0, 0, -7, voxel ? "planks" : "plain");
      block(group, k, 0.4, 10, 12, voxel ? "#c9b8f5" : "#cfc2f7", -8, 0, -1, voxel ? "planks" : "plain");
      block(group, k, 0.4, 10, 12, voxel ? "#c9b8f5" : "#cfc2f7", 8, 0, -1, voxel ? "planks" : "plain");
      // bed
      block(group, k, 4.6, 1, 7, "#7a4b2a", -3.8, 0, -3, "planks");
      block(group, k, 4.4, 0.6, 6.6, "#f5f3ee", -3.8, 1, -3, "fabric");
      block(group, k, 4.4, 0.7, 4.4, "#3d7bf2", -3.8, 1.2, -1.9, "fabric");
      block(group, k, 2, 0.6, 1.2, "#ffffff", -3.8, 1.6, -5.6, "fabric");
      block(group, k, 4.6, 2.4, 0.4, "#7a4b2a", -3.8, 0, -6.6, "planks");
      // window
      block(group, k, 4, 3, 0.1, night ? "#1a2550" : "#a9dcff", 3.5, 3.5, -6.75, "glass");
      block(group, k, 4.4, 0.3, 0.3, "#f5f3ee", 3.5, 3.3, -6.6, "plain");
      // lamp + rug + poster
      block(group, k, 1, 1.4, 1, "#7a4b2a", 0.2, 0, -5.8, "planks");
      block(group, k, 0.6, 0.6, 0.6, "#ffd27a", 0.2, 1.4, -5.8, "plain", { emissive: "#ffd27a", emissiveIntensity: night ? 1.4 : 0.3 });
      block(group, k, 5, 0.04, 3.5, "#e76f51", 2.5, 0, 0, "fabric");
      block(group, k, 2, 2.6, 0.06, "#B9F36A", 6.8, 4, -6.75, "plain");
      screenAnchor.set(-3.8, 6.4, -4.5);
      break;
    }
    case "city_plaza": {
      ground(group, k, "#c9c3b6", "tiles");
      const cols = ["#9aa5b1", "#c7b199", "#7f8fa6", "#b8c4d6", "#a69b8d"];
      for (let i = -4; i <= 4; i++) {
        const h = 10 + r.next() * 16;
        tower(group, k, i * 7, -18 - r.next() * 4, 5.5, h, cols[(i + 4) % cols.length], night, hashString(env) + i);
      }
      // fountain
      block(group, k, 6, 0.8, 6, "#d9d4c8", 0, 0, -8, "stone");
      block(group, k, 5.2, 0.2, 5.2, voxel ? "#3f76e4" : "#5bb6f0", 0, 0.7, -8, "water");
      block(group, k, 0.8, 2.4, 0.8, "#d9d4c8", 0, 0.8, -8, "stone");
      const jet = block(group, k, 0.4, 1.4, 0.4, "#bfe6ff", 0, 3.2, -8, "water", { transparent: true, opacity: 0.8 });
      animated.push((t) => {
        jet.scale.y = 0.8 + Math.sin(t * 6) * 0.2;
      });
      for (const x of [-10, 10]) lamp(group, k, x, -2, night);
      tree(group, k, -14, -6, 0.9);
      tree(group, k, 14, -6, 0.9);
      screenAnchor.set(0, 9, -12);
      break;
    }
    case "school_hall": {
      interior = true;
      block(group, k, 40, 0.2, 14, "#e9e4da", 0, -0.2, -1, "tiles");
      block(group, k, 40, 9, 0.4, "#f2efe8", 0, 0, -8, "plain");
      for (let i = -9; i <= 9; i++) {
        const c = i % 3 === 0 ? "#3d7bf2" : i % 3 === 1 ? "#2a9d8f" : "#e76f51";
        block(group, k, 1.6, 4.6, 0.8, c, i * 1.75, 0, -7.4, voxel ? "noise" : "plain");
        block(group, k, 0.6, 0.12, 0.05, "#1a1a1a", i * 1.75, 3.8, -6.98, "plain");
      }
      block(group, k, 40, 0.4, 14, "#f5f3ee", 0, 9, -1, "plain");
      for (let x = -12; x <= 12; x += 6) block(group, k, 3, 0.2, 0.8, "#ffffff", x, 8.7, -2, "plain", { emissive: "#ffffff", emissiveIntensity: 1 });
      block(group, k, 5, 2.4, 0.1, "#B9F36A", 9, 5.3, -7.75, "plain");
      screenAnchor.set(0, 6.6, -6);
      break;
    }
    case "office": {
      interior = true;
      block(group, k, 40, 0.2, 14, "#5b6170", -0, -0.2, -1, "fabric");
      block(group, k, 40, 10, 0.4, "#e8e6e1", 0, 0, -8, "plain");
      for (let x = -15; x <= 15; x += 5) block(group, k, 3.6, 5, 0.1, night ? "#1d2a55" : "#b3dcff", x, 2.5, -7.75, "glass");
      for (const x of [-7, 0, 7]) {
        block(group, k, 4, 0.2, 2, "#f5f3ee", x, 2, -4.5, "planks");
        block(group, k, 0.2, 2, 1.6, "#3a3a3a", x - 1.8, 0, -4.5, "plain");
        block(group, k, 0.2, 2, 1.6, "#3a3a3a", x + 1.8, 0, -4.5, "plain");
        block(group, k, 1.8, 1.2, 0.12, "#151515", x, 2.2, -5, "plain");
        block(group, k, 1.6, 1, 0.05, "#7fd3ff", x, 2.3, -4.92, "plain", { emissive: "#7fd3ff", emissiveIntensity: 0.6 });
      }
      block(group, k, 1.2, 1.6, 1.2, "#2f9a44", 12, 0, -6, "leaves");
      screenAnchor.set(0, 7, -6.5);
      break;
    }
    case "beach": {
      ground(group, k, "#ecd9a6", "sand");
      const water = block(group, k, 120, 0.3, 40, voxel ? "#3f76e4" : "#3fb3e8", 0, -0.1, -28, "water");
      animated.push((t) => {
        water.position.y = 0.05 + Math.sin(t * 1.4) * 0.06;
      });
      for (const [x, z] of [[-11, -4], [10, -6], [16, -2]]) {
        const g = new THREE.Group();
        for (let i = 0; i < 6; i++) block(g, k, 0.6, 1, 0.6, "#8d6a43", i * 0.12, i, 0, "bark");
        if (voxel) block(g, k, 4, 0.6, 4, "#3fae4a", 0.6, 6, 0, "leaves");
        else for (let i = 0; i < 5; i++) {
          const leaf = k.box(3.2, 0.12, 0.8, "#3fae4a", "plain");
          leaf.position.set(0.6, 6.1, 0);
          leaf.rotation.y = (i / 5) * Math.PI * 2;
          leaf.rotation.z = -0.25;
          g.add(leaf);
        }
        put(group, g, x, 0, z);
      }
      block(group, k, 0.2, 3.4, 0.2, "#f5f3ee", 6, 0, -1.5, "plain");
      const umb = voxel ? k.box(3.4, 0.4, 3.4, "#e63946", "fabric") : new THREE.Mesh(new THREE.ConeGeometry(2, 0.9, 12), k.mat("#e63946", "plain"));
      put(group, umb, 6, 3.6, -1.5);
      block(group, k, 2.4, 0.15, 1.2, "#ffd166", 3, 0, 1, "fabric");
      screenAnchor.set(0, 8, -8);
      break;
    }
    case "forest": {
      ground(group, k, voxel ? "#4f9a35" : "#5fb24a", "grass");
      for (let i = 0; i < 26; i++) {
        const x = (r.next() - 0.5) * 50;
        const z = -4 - r.next() * 26;
        if (Math.abs(x) < 4 && z > -9) continue;
        tree(group, k, x, z, 0.9 + r.next() * 0.7, r.pick(["#2f8a3c", "#3fae4a", "#276f33"]));
      }
      tree(group, k, -8, 1, 1.3, "#2f8a3c");
      tree(group, k, 9, 0, 1.2, "#276f33");
      for (let i = 0; i < 8; i++) {
        const x = (r.next() - 0.5) * 22, z = -2 - r.next() * 8;
        block(group, k, 0.3, 0.5, 0.3, "#f5f3ee", x, 0, z, "plain");
        block(group, k, 0.8, 0.35, 0.8, "#e63946", x, 0.5, z, "plain");
      }
      for (let i = 0; i < 6; i++) block(group, k, 1 + r.next(), 0.8, 1 + r.next(), "#8a8f96", (r.next() - 0.5) * 30, 0, -3 - r.next() * 10, "stone");
      break;
    }
    case "store": {
      interior = true;
      block(group, k, 40, 0.2, 16, "#e9e4da", 0, -0.2, -2, "tiles");
      block(group, k, 40, 9, 0.4, "#dfe8e4", 0, 0, -10, "plain");
      const productColors = ["#e63946", "#f5c518", "#3d7bf2", "#2a9d8f", "#f2643d", "#7a5cfa", "#f5f3ee"];
      for (const z of [-8.5, -5]) {
        for (let x = -14; x <= 14; x += 7) {
          block(group, k, 5.6, 0.2, 1.4, "#c9ced6", x, 0.4, z, "plain");
          for (const y of [0.6, 1.9, 3.2]) {
            block(group, k, 5.6, 0.12, 1.4, "#c9ced6", x, y + 1.0, z, "plain");
            for (let i = 0; i < 7; i++) {
              const c = productColors[(i + Math.round(x) + Math.round(y * 3)) % productColors.length];
              block(group, k, 0.6, 0.85, 0.7, c, x - 2.4 + i * 0.8, y + 0.15, z, "plain");
            }
          }
        }
      }
      block(group, k, 5, 1.6, 1.6, "#2a2f3a", 9, 0, 1.5, "plain");
      block(group, k, 1, 0.7, 0.6, "#151515", 8, 1.6, 1.5, "plain");
      for (let x = -12; x <= 12; x += 6) block(group, k, 3.2, 0.15, 0.6, "#ffffff", x, 8.6, -4, "plain", { emissive: "#ffffff", emissiveIntensity: 1.1 });
      screenAnchor.set(0, 6.8, -9);
      break;
    }
    case "stage": {
      interior = true;
      block(group, k, 60, 0.2, 40, "#1a1a1f", 0, -0.2, 0, "tiles");
      block(group, k, 18, 1, 9, "#2a2a33", 0, -0.2, -3, "planks");
      block(group, k, 22, 12, 0.4, "#7a1424", 0, 0, -8, "fabric");
      block(group, k, 22, 1.4, 0.6, "#b0202f", 0, 10.6, -7.6, "fabric");
      for (let i = -4; i <= 4; i++) block(group, k, 0.3, 12, 0.3, "#5a0e1a", i * 2.5, 0, -7.7, "fabric");
      const lights: THREE.Mesh[] = [];
      for (let i = -2; i <= 2; i++) lights.push(block(group, k, 0.8, 0.6, 0.8, "#fff2c0", i * 4, 9.5, -2, "plain", { emissive: "#fff2c0", emissiveIntensity: 1.5 }));
      animated.push((t) => lights.forEach((l, i) => (l.rotation.y = Math.sin(t * 2 + i) * 0.5)));
      screenAnchor.set(0, 7.5, -7.4);
      break;
    }
  }

  return {
    group,
    sky: new THREE.Color(interior && env !== "stage" ? (night ? "#0e1226" : "#20242c") : env === "stage" ? "#0b0b10" : sky.sky),
    fogNear: interior ? 30 : 40,
    fogFar: interior ? 80 : 110,
    sunColor: new THREE.Color(sky.sun),
    sunIntensity: interior ? sky.sunI * 0.7 : sky.sunI,
    hemiSky: new THREE.Color(sky.hemiSky),
    hemiGround: new THREE.Color(sky.hemiGround),
    hemiIntensity: interior ? Math.max(1.1, sky.hemiI) : sky.hemiI,
    screenAnchor,
    interior,
    update: (t) => animated.forEach((f) => f(t)),
  };
}

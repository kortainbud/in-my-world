/**
 * Style kit: one set of primitives that renders as smooth plastic ("roblox")
 * or pixel-textured voxels ("minecraft"). Environment and prop builders only
 * talk to the kit, so every world exists in both styles.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { VisualStyle } from "@/lib/engine/types";
import { hashString, rng } from "@/lib/engine/rng";

export type Pattern =
  | "plain"
  | "noise"
  | "planks"
  | "bricks"
  | "stone"
  | "grass"
  | "leaves"
  | "glass"
  | "water"
  | "sand"
  | "tiles"
  | "fabric"
  | "bark";

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

const texCache = new Map<string, THREE.CanvasTexture>();

/** 16×16 pixel texture for the voxel style. */
export function pixelTexture(color: string, pattern: Pattern): THREE.CanvasTexture {
  const key = `${color}|${pattern}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 16;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const r = rng(hashString(key));
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  const px = (x: number, y: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = r.next();
      if (pattern === "plain") continue;
      if (n < 0.22) px(x, y, shade(color, -0.05));
      else if (n > 0.85) px(x, y, shade(color, 0.05));
    }
  if (pattern === "planks") {
    for (let y = 0; y < S; y += 4) {
      g.fillStyle = shade(color, -0.14);
      g.fillRect(0, y + 3, S, 1);
      const off = (y / 4) % 2 ? 4 : 11;
      g.fillRect(off, y, 1, 3);
    }
  } else if (pattern === "bricks") {
    g.fillStyle = shade(color, 0.18);
    for (let y = 0; y < S; y += 4) {
      g.fillRect(0, y + 3, S, 1);
      const off = (y / 4) % 2 ? 0 : 4;
      for (let x = off; x < S; x += 8) g.fillRect(x, y, 1, 3);
    }
  } else if (pattern === "stone") {
    for (let i = 0; i < 14; i++) px(r.int(0, 15), r.int(0, 15), shade(color, -0.12));
  } else if (pattern === "grass") {
    for (let i = 0; i < 40; i++) px(r.int(0, 15), r.int(0, 15), shade(color, r.next() > 0.5 ? 0.08 : -0.1));
  } else if (pattern === "leaves") {
    for (let i = 0; i < 60; i++) px(r.int(0, 15), r.int(0, 15), shade(color, r.next() > 0.5 ? 0.1 : -0.16));
  } else if (pattern === "glass") {
    g.fillStyle = shade(color, 0.25);
    g.fillRect(0, 0, S, 1);
    g.fillRect(0, 0, 1, S);
    g.fillRect(3, 3, 1, 3);
    g.fillRect(4, 2, 1, 1);
  } else if (pattern === "water") {
    for (let i = 0; i < 18; i++) {
      const x = r.int(0, 13), y = r.int(0, 15);
      g.fillStyle = shade(color, 0.12);
      g.fillRect(x, y, 3, 1);
    }
  } else if (pattern === "tiles") {
    g.fillStyle = shade(color, -0.1);
    g.fillRect(0, 0, S, 1);
    g.fillRect(0, 0, 1, S);
  } else if (pattern === "bark") {
    for (let x = 0; x < S; x += 3) {
      g.fillStyle = shade(color, -0.12);
      g.fillRect(x, 0, 1, S);
    }
  } else if (pattern === "fabric") {
    for (let y = 0; y < S; y += 2) {
      g.fillStyle = shade(color, -0.05);
      g.fillRect(0, y, S, 1);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  texCache.set(key, t);
  return t;
}

/** BoxGeometry whose UVs are in world units, so pixel textures tile at one block per unit. */
function worldUVBox(w: number, h: number, d: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z — 4 verts each.
  const dims: [number, number][] = [
    [d, h], [d, h], [w, d], [w, d], [w, h], [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  uv.needsUpdate = true;
  return geo;
}

const matCache = new Map<string, THREE.Material>();

function extra(opts?: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number }) {
  const o: { emissive?: THREE.Color; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {};
  if (opts?.emissive) {
    o.emissive = new THREE.Color(opts.emissive);
    o.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  if (opts?.transparent) {
    o.transparent = true;
    o.opacity = opts.opacity ?? 1;
  }
  return o;
}

export interface Kit {
  style: VisualStyle;
  mat(color: string, pattern?: Pattern, opts?: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number }): THREE.Material;
  box(w: number, h: number, d: number, color: string, pattern?: Pattern, opts?: Parameters<Kit["mat"]>[2]): THREE.Mesh;
  /** Rounded in plastic style, a cube in voxel style. */
  blob(size: number, color: string, pattern?: Pattern): THREE.Mesh;
  cyl(radius: number, height: number, color: string, pattern?: Pattern): THREE.Mesh;
}

export function makeKit(style: VisualStyle): Kit {
  const voxel = style === "minecraft";
  const mat: Kit["mat"] = (color, pattern = "noise", opts) => {
    const key = `${style}|${color}|${pattern}|${JSON.stringify(opts ?? {})}`;
    const hit = matCache.get(key);
    if (hit) return hit;
    let m: THREE.Material;
    if (voxel) {
      m = new THREE.MeshLambertMaterial({ map: pixelTexture(color, pattern), ...extra(opts) });
    } else {
      m = new THREE.MeshStandardMaterial({ color, roughness: pattern === "glass" || pattern === "water" ? 0.15 : 0.55, metalness: 0, ...extra(opts) });
    }
    matCache.set(key, m);
    return m;
  };
  const shadowed = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  return {
    style,
    mat,
    box(w, h, d, color, pattern = "noise", opts) {
      const geo = voxel ? worldUVBox(w, h, d) : new THREE.BoxGeometry(w, h, d);
      return shadowed(new THREE.Mesh(geo, mat(color, pattern, opts)));
    },
    blob(size, color, pattern = "leaves") {
      if (voxel) return shadowed(new THREE.Mesh(worldUVBox(size, size, size), mat(color, pattern)));
      return shadowed(new THREE.Mesh(new THREE.SphereGeometry(size * 0.6, 20, 14), mat(color, "plain")));
    },
    cyl(radius, height, color, pattern = "noise") {
      if (voxel) return shadowed(new THREE.Mesh(worldUVBox(radius * 2, height, radius * 2), mat(color, pattern)));
      return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), mat(color, "plain")));
    },
  };
}

export function roundedBox(w: number, h: number, d: number, radius: number) {
  return new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, Math.min(w, h, d) / 2 - 0.001));
}

export { shade };

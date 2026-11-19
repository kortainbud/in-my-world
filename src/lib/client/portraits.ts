"use client";
/**
 * Renders character portraits with ONE shared WebGL context and caches them as
 * image URLs, so grids of characters don't each need their own canvas.
 */
import * as THREE from "three";
import type { Appearance, VisualStyle } from "@/lib/engine/types";
import { buildAvatar } from "@/lib/render/avatar";

let renderer: THREE.WebGLRenderer | null = null;
const cache = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

function setup() {
  if (renderer) return renderer;
  const canvas = document.createElement("canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(360, 440, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return renderer;
}

export function portrait(ap: Appearance, style: VisualStyle, opts: { pose?: "idle" | "wave"; full?: boolean } = {}): Promise<string> {
  const key = JSON.stringify([ap, style, opts]);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (queue = queue.then(async () => {
    const r = setup();
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#5a5050", 1.6));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(4, 8, 10);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#b9f36a", 0.8);
    rim.position.set(-6, 4, -6);
    scene.add(rim);
    const av = buildAvatar(ap, style);
    av.setExpression("happy");
    av.root.rotation.y = -0.35;
    if (opts.pose === "wave") av.armR.rotation.z = 2.6;
    else {
      av.armL.rotation.z = -0.1;
      av.armR.rotation.z = 0.1;
    }
    scene.add(av.root);
    const h = av.topY;
    const cam = new THREE.PerspectiveCamera(opts.full ? 32 : 26, 360 / 440, 0.1, 100);
    if (opts.full) {
      cam.position.set(0, h * 0.55, 15);
      cam.lookAt(0, h * 0.5, 0);
    } else {
      cam.position.set(0, h * 0.78, 10);
      cam.lookAt(0, h * 0.7, 0);
    }
    r.render(scene, cam);
    const url = r.domElement.toDataURL("image/png");
    av.dispose();
    return url;
  })) as Promise<string>;
  cache.set(key, p);
  return p;
}

"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Appearance, VisualStyle } from "@/lib/engine/types";
import { buildAvatar, type Avatar } from "@/lib/render/avatar";

/** Live, slowly turning 3D preview of one character (one WebGL context). */
export function CharacterPreview({ appearance, style, className = "" }: { appearance: Appearance; style: VisualStyle; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; av?: Avatar; raf: number; drag: number } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    el.appendChild(r.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#4a4040", 1.5));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(5, 10, 8);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#b9f36a", 1);
    rim.position.set(-6, 5, -6);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const s = { r, scene, cam, raf: 0, drag: 0 };
    state.current = s;
    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      r.setSize(w, h, false);
      r.domElement.style.width = "100%";
      r.domElement.style.height = "100%";
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      const av = state.current?.av;
      if (av) {
        av.root.rotation.y = Math.sin(t * 0.5) * 0.6 + s.drag;
        av.body.position.y = Math.sin(t * 2) * 0.03;
        av.armR.rotation.z = 0.08 + Math.max(0, Math.sin(t * 0.9)) * (Math.sin(t * 9) * 0.3 + 2.2) * (Math.sin(t * 0.9) > 0.6 ? 1 : 0);
        const h = av.topY;
        cam.position.set(0, h * 0.62, h * 2.9);
        cam.lookAt(0, h * 0.5, 0);
      }
      r.render(scene, cam);
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
    let down: number | null = null;
    const pd = (e: PointerEvent) => (down = e.clientX);
    const pm = (e: PointerEvent) => {
      if (down === null) return;
      s.drag += (e.clientX - down) * 0.01;
      down = e.clientX;
    };
    const pu = () => (down = null);
    r.domElement.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
      r.dispose();
      r.domElement.remove();
      state.current = null;
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!s) return;
    if (s.av) {
      s.scene.remove(s.av.root);
      s.av.dispose();
    }
    const av = buildAvatar(appearance, style);
    av.setExpression("happy");
    av.root.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    s.scene.add(av.root);
    s.av = av;
  }, [appearance, style]);

  return <div ref={host} className={`cursor-grab touch-none active:cursor-grabbing ${className}`} aria-label="3D character preview. Drag to rotate." role="img" />;
}

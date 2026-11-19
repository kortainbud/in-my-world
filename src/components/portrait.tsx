"use client";
import { useEffect, useState } from "react";
import type { Appearance, VisualStyle } from "@/lib/engine/types";
import { portrait } from "@/lib/client/portraits";

export function Portrait({ appearance, style = "roblox", full, pose, className = "", alt = "" }: { appearance: Appearance; style?: VisualStyle; full?: boolean; pose?: "idle" | "wave"; className?: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    portrait(appearance, style, { full, pose }).then((u) => live && setSrc(u)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [appearance, style, full, pose]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className={`object-contain ${className}`} /> : <div aria-hidden className={`animate-pulse rounded-[8px] bg-bg-3/60 ${className}`} />;
}

"use client";
import { useEffect, type RefObject } from "react";

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

export function trackShare(target: string) {
  send({ target, event: "share" });
}

/**
 * Reports real playback from a <video>: plays (including replays), seconds
 * actually watched, furthest point reached and completion. Powers the
 * retention metrics on the project page.
 */
export function useWatchTracking(ref: RefObject<HTMLVideoElement | null>, target: string | null | undefined) {
  useEffect(() => {
    const v = ref.current;
    if (!v || !target) return;
    let last = v.currentTime;
    let pending = 0;
    let lastSent = performance.now();
    const flush = () => {
      if (pending > 0.05) send({ target, event: "progress", delta: Math.round(pending * 10) / 10, position: v.currentTime });
      pending = 0;
      lastSent = performance.now();
    };
    const onPlay = () => {
      // A play from the start (or after the end) counts as a play.
      if (v.currentTime < 0.5 || v.ended) send({ target, event: "play", position: 0 });
      last = v.currentTime;
    };
    const onTime = () => {
      const d = v.currentTime - last;
      if (d > 0 && d < 1.5) pending += d; // ignore seeks
      last = v.currentTime;
      if (performance.now() - lastSent > 2000) flush();
    };
    const onEnded = () => {
      flush();
      send({ target, event: "ended", position: v.duration });
    };
    const onPause = () => flush();
    v.addEventListener("play", onPlay);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("pause", onPause);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      v.removeEventListener("play", onPlay);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("pause", onPause);
      window.removeEventListener("pagehide", flush);
    };
  }, [ref, target]);
}

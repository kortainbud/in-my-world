"use client";
import { useEffect, useRef, useState, type ReactNode, type VideoHTMLAttributes } from "react";
import { useWatchTracking } from "@/lib/client/track";
import { fmtDuration } from "@/lib/client/api";
import type { VisualStyle } from "@/lib/engine/types";
import { btn, Modal, StyleTag, Tag } from "./ui";

export interface VideoItem {
  id: string;
  title: string;
  prompt: string;
  style: VisualStyle;
  durationSec: number;
  video: string;
  thumb: string;
  isSample?: boolean;
  views?: number;
  owner?: { handle: string; displayName: string };
  category?: string;
}

/** Thumbnail card with a muted hover preview. */
export function VideoCard({ item, onOpen, footer, size = "md" }: { item: VideoItem; onOpen: () => void; footer?: ReactNode; size?: "md" | "lg" }) {
  const vref = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    if (hover) {
      v.currentTime = 0;
      void v.play().catch(() => undefined);
    } else v.pause();
  }, [hover]);
  return (
    <div className="group">
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={`Play “${item.title}”`}
        className="relative block aspect-[9/16] w-full overflow-hidden rounded-[12px] border border-line-soft bg-bg-3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        {hover && <video ref={vref} src={item.video} muted playsInline loop preload="none" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-2">
          <StyleTag style={item.style} />
          {item.isSample && <span className="rounded-[5px] bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-white/80 backdrop-blur">Sample</span>}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-10">
          <span className={`flex items-center justify-center rounded-full bg-white text-[#131316] transition-transform group-hover:scale-105 ${size === "lg" ? "h-11 w-11" : "h-9 w-9"}`}>
            <PlayIcon />
          </span>
          <span className="rounded-[5px] bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">{fmtDuration(item.durationSec)}</span>
        </div>
      </button>
      <div className="mt-2.5">
        <p className="truncate text-[14px] font-medium">{item.title}</p>
        {footer ?? <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-fg-2">{item.prompt}</p>}
      </div>
    </div>
  );
}

export function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <path d="M3 1.5v11l9.5-5.5z" fill="currentColor" />
    </svg>
  );
}

/** A <video> that reports real playback for retention metrics. */
export function TrackedVideo({ target, ...props }: VideoHTMLAttributes<HTMLVideoElement> & { target: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useWatchTracking(ref, target);
  return <video ref={ref} {...props} />;
}

/** Full player in a modal: native controls, download, title + prompt. */
export function VideoModal({ item, onClose, actions }: { item: VideoItem | null; onClose: () => void; actions?: ReactNode }) {
  const [counted, setCounted] = useState<string | null>(null);
  return (
    <Modal open={!!item} onClose={onClose} label={item?.title ?? "Video"}>
      {item && (
        <div className="flex max-h-[94vh] w-[min(920px,96vw)] flex-col overflow-hidden rounded-[14px] border border-line bg-bg-2 md:flex-row">
          <div className="flex items-center justify-center bg-black md:w-[min(420px,50vh)]">
            <TrackedVideo
              target={item.id}
              key={item.video}
              src={item.video}
              controls
              autoPlay
              playsInline
              className="aspect-[9/16] max-h-[70vh] w-auto md:max-h-[86vh] md:w-full"
              onPlay={() => {
                if (counted === item.id) return;
                setCounted(item.id);
                void fetch(`/api/explore/${item.id}/view`, { method: "POST" }).catch(() => undefined);
              }}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <StyleTag style={item.style} />
                  {item.isSample && <Tag>Sample · made with the dev engine</Tag>}
                  {item.category && <Tag>{item.category}</Tag>}
                </div>
                <h2 className="text-xl font-semibold tracking-[-0.02em]">{item.title}</h2>
                {item.owner && <p className="mt-1 text-[13px] text-fg-2">by {item.owner.displayName}</p>}
              </div>
              <button onClick={onClose} className={btn("ghost", "sm", "!px-2")} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" /></svg>
              </button>
            </div>
            <div className="rounded-[10px] border border-line-soft bg-bg p-3.5">
              <p className="eyebrow mb-1.5">The idea</p>
              <p className="text-[15px] leading-snug">{item.prompt}</p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              {actions}
              <a href={item.video} download={`${item.title.replace(/[^\w-]+/g, "-")}.mp4`} className={btn("secondary", "md")}>
                Download MP4
              </a>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

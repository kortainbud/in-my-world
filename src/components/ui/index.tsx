"use client";
import Link from "next/link";
import { useEffect, useRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { STYLE_LABELS } from "@/config/site";
import type { VisualStyle } from "@/lib/engine/types";

import { btn, type Size, type Variant } from "./btn";

export { btn };

export function Button({ variant = "secondary", size = "md", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button {...p} className={btn(variant, size, className)} />;
}

export function LinkButton({ variant = "secondary", size = "md", className = "", ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...p} className={btn(variant, size, className)} />;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-[-0.03em] ${className}`}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="4" fill="#B9F36A" />
        <rect x="6" y="6" width="4" height="4" fill="#101010" />
        <rect x="12" y="6" width="4" height="4" fill="#101010" />
        <rect x="6" y="13" width="10" height="3" fill="#101010" />
      </svg>
      In My World
    </span>
  );
}

export function StyleTag({ style, className = "" }: { style: VisualStyle; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[5px] bg-black/60 px-1.5 py-0.5 font-mono text-micro uppercase tracking-wide text-white backdrop-blur ${className}`}>
      <span className={`h-1.5 w-1.5 ${style === "minecraft" ? "bg-[#7FC34A]" : "rounded-full bg-accent"}`} />
      {STYLE_LABELS[style].label}
    </span>
  );
}

export function Tag({ children, tone = "default", className = "" }: { children: ReactNode; tone?: "default" | "accent" | "warn" | "danger"; className?: string }) {
  const tones = {
    default: "border-line text-fg-2",
    accent: "border-[var(--accent-line)] text-accent bg-[var(--accent-soft)]",
    warn: "border-[var(--warn-line)] text-warn bg-[var(--warn-bg)]",
    danger: "border-[var(--danger-line)] text-danger bg-[var(--danger-bg)]",
  };
  return <span className={`inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-micro font-medium ${tones[tone]} ${className}`}>{children}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function Notice({ tone = "default", children, className = "" }: { tone?: "default" | "danger" | "warn" | "accent"; children: ReactNode; className?: string }) {
  const tones = {
    default: "border-line bg-bg-2 text-fg-2",
    danger: "border-[var(--danger-line)] bg-[var(--danger-bg)] text-[var(--danger-fg)]",
    warn: "border-[var(--warn-line)] bg-[var(--warn-bg)] text-[var(--warn-fg)]",
    accent: "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-text)]",
  };
  return <div role={tone === "danger" ? "alert" : undefined} className={`rounded-[10px] border px-3.5 py-2.5 text-small leading-relaxed ${tones[tone]} ${className}`}>{children}</div>;
}

export function Segmented<T extends string | number>({
  value, onChange, options, label, className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean; hint?: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-[9px] border border-line bg-bg-2 p-0.5 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`h-8 rounded-[7px] px-3 text-small font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-fg text-bg" : "text-fg-2 hover:text-fg"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, children, label, className = "" }: { open: boolean; onClose: () => void; children: ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto max-h-[94vh] max-w-[96vw] overflow-visible bg-transparent p-0 text-fg backdrop:bg-black/80 backdrop:backdrop-blur-sm ${className}`}
    >
      {open && children}
    </dialog>
  );
}

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-line px-6 py-16 text-center">
      <p className="text-body font-medium">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-small text-fg-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-small font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-caption text-fg-3">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-[8px] border border-line bg-bg-2 px-3 text-sm text-fg placeholder:text-fg-3 outline-none transition-colors focus:border-[var(--line-strong)]";

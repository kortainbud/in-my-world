/** Button class helper — usable from server and client components. */
export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-[var(--accent-hover)] active:opacity-90",
  secondary: "bg-bg-3 text-fg border border-line hover:border-[var(--line-strong)] hover:bg-[var(--hover)]",
  ghost: "text-fg-2 hover:text-fg hover:bg-bg-3",
  danger: "bg-transparent text-danger border border-[var(--danger-line)] hover:bg-[var(--danger-bg)]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-small rounded-[var(--btn-radius)]",
  md: "h-10 px-4 text-sm rounded-[var(--btn-radius)]",
  lg: "h-12 px-5 text-body rounded-[var(--btn-radius)]",
};

export function btn(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}


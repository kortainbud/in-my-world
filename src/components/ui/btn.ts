/** Button class helper — usable from server and client components. */
export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-[#c9f88a] active:bg-[#a8e05a]",
  secondary: "bg-bg-3 text-fg border border-line hover:border-[#444] hover:bg-[#262626]",
  ghost: "text-fg-2 hover:text-fg hover:bg-bg-3",
  danger: "bg-transparent text-danger border border-[#4a2a26] hover:bg-[#2a1715]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[7px]",
  md: "h-10 px-4 text-sm rounded-[8px]",
  lg: "h-12 px-5 text-[15px] rounded-[10px]",
};

export function btn(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}


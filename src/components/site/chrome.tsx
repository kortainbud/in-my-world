"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { Scene, ThemeToggle } from "./fx";

export function SiteLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] ${className}`}>
      <svg width="26" height="26" viewBox="0 0 22 22" aria-hidden>
        <rect x="1" y="1" width="20" height="20" rx="5" fill="#29A9F2" />
        <rect x="1" y="14" width="20" height="7" fill="#7FD14F" />
        <rect x="6" y="5" width="3.5" height="3.5" fill="#131316" />
        <rect x="12.5" y="5" width="3.5" height="3.5" fill="#131316" />
        <rect x="6" y="10.5" width="10" height="2.2" fill="#131316" />
      </svg>
      in my world
    </span>
  );
}

const LINKS = [
  { href: "/explore", label: "explore" },
  { href: "/characters", label: "characters" },
  { href: "/#how-it-works", label: "how it works" },
  { href: "/pricing", label: "pricing" },
];

const pill = "inline-flex h-10 items-center justify-center rounded-full px-4 text-[15px] font-medium transition-colors";
const primary = "bg-[var(--pill-bg)] text-[var(--pill-fg)] hover:bg-[var(--pill-hover)]";

export function SiteNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    api<{ user: unknown }>("/api/me").then((d) => setSignedIn(!!d.user)).catch(() => setSignedIn(false));
  }, []);
  useEffect(() => setOpen(false), [path]);
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft/0 bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-5 sm:px-6">
        <Link href="/" aria-label="In My World home">
          <SiteLogo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <ThemeToggle />
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-[15px] font-medium text-fg transition-colors hover:bg-bg-2">
              {l.label}
            </Link>
          ))}
          {signedIn ? (
            <Link href="/studio" className={`${pill} ml-2 ${primary}`}>
              open studio
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-full px-3 py-1.5 text-[15px] font-medium text-fg hover:bg-bg-2">
                sign in
              </Link>
              <Link href="/sign-up?next=/studio" className={`${pill} ml-1 ${primary}`}>
                create a video
              </Link>
            </>
          )}
        </nav>
        <span className="flex items-center gap-1 md:hidden">
        <ThemeToggle />
        <button className={`${pill} bg-bg-2 text-fg`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu">
          {open ? "close" : "menu"}
        </button>
        </span>
      </div>
      {open && (
        <div id="site-menu" className="absolute inset-x-0 top-[72px] border-b border-line bg-bg px-5 pb-6 pt-2 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)] md:hidden">
          <nav className="flex flex-col" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="border-b border-line-soft py-3.5 text-[17px] font-medium">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link href={signedIn ? "/studio/projects" : "/sign-in"} className={`${pill} bg-bg-2`}>
              {signedIn ? "my studio" : "sign in"}
            </Link>
            <Link href={signedIn ? "/studio" : "/sign-up?next=/studio"} className={`${pill} ${primary}`}>
              create a video
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const path = usePathname();
  const home = path === "/";
  const cols = [
    { title: "product", links: [{ href: "/studio", label: "studio" }, { href: "/#how-it-works", label: "how it works" }, { href: "/pricing", label: "pricing" }, { href: "/sign-in", label: "sign in" }] },
    { title: "explore", links: [{ href: "/explore", label: "stories" }, { href: "/characters", label: "characters" }, { href: "/#examples", label: "examples" }] },
    { title: "learn", links: [{ href: "/docs", label: "docs" }, { href: "/pricing#credits", label: "how credits work" }, { href: "/#questions", label: "questions" }] },
    { title: "legal", links: [{ href: "/terms", label: "terms" }, { href: "/privacy", label: "privacy" }, { href: "/contact", label: "contact" }] },
  ];
  return (
    <footer className="relative mt-auto overflow-hidden bg-[var(--sand)] text-[var(--sand-fg)]">
      {/* Sky, sea and sand; the sand colour continues below the image. */}
      <div className="absolute left-1/2 top-0 w-full min-w-[900px] -translate-x-1/2">
        <Scene name="finale" className="block h-auto w-full" />
      </div>
      <div className="relative">
        {home ? (
          <div className="flex flex-col items-center justify-center px-5 pb-10 text-center" style={{ height: "calc(max(100vw, 900px) * 0.7031 * 0.56)" }}>
            <h2 className="text-[44px] font-medium leading-[0.95] tracking-[-0.055em] text-white [text-shadow:0_2px_24px_rgba(0,40,90,0.3)] sm:text-[80px]">what happens in your world?</h2>
            <p className="mx-auto mt-4 max-w-md text-[17px] font-medium text-white/95">type one sentence. post a video today.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Link href="/sign-up?next=/studio" className={`${pill} h-12 px-6 text-[16px] ${primary}`}>
                create my world
              </Link>
              <Link href="/explore" className={`${pill} h-12 bg-white px-6 text-[16px] text-[#131316] hover:bg-[#f5f5f3]`}>
                explore stories
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ height: "calc(max(100vw, 900px) * 0.7031 * 0.56)" }} />
        )}
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 pb-14 pt-8 sm:px-6 md:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div>
            <SiteLogo />
            <p className="mt-4 max-w-[260px] text-[15px] leading-relaxed text-[var(--sand-fg-2)]">turn any idea into a whole world.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="mb-3 font-mono text-[13px] text-[var(--sand-fg-2)]">{c.title}</p>
              <ul className="space-y-2">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[15px] font-medium hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

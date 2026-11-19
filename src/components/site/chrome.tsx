"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

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

export function SiteNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    api<{ user: unknown }>("/api/me").then((d) => setSignedIn(!!d.user)).catch(() => setSignedIn(false));
  }, []);
  useEffect(() => setOpen(false), [path]);
  return (
    <header className="relative z-40">
      <div className="mx-auto flex h-[75px] max-w-[1200px] items-center justify-between px-5 sm:px-6">
        <Link href="/" aria-label="In My World home">
          <SiteLogo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-[15px] font-medium text-fg transition-colors hover:bg-bg-2">
              {l.label}
            </Link>
          ))}
          {signedIn ? (
            <Link href="/studio" className={`${pill} ml-2 bg-fg text-white hover:bg-[#2c2c33]`}>
              open studio
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="rounded-full px-3 py-1.5 text-[15px] font-medium text-fg hover:bg-bg-2">
                sign in
              </Link>
              <Link href="/sign-up?next=/studio" className={`${pill} ml-1 bg-fg text-white hover:bg-[#2c2c33]`}>
                create a video
              </Link>
            </>
          )}
        </nav>
        <button className={`${pill} bg-bg-2 text-fg md:hidden`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu">
          {open ? "close" : "menu"}
        </button>
      </div>
      {open && (
        <div id="site-menu" className="absolute inset-x-0 top-[75px] border-b border-line bg-white px-5 pb-6 pt-2 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)] md:hidden">
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
            <Link href={signedIn ? "/studio" : "/sign-up?next=/studio"} className={`${pill} bg-fg text-white`}>
              create a video
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const cols = [
    { title: "product", links: [{ href: "/studio", label: "studio" }, { href: "/#how-it-works", label: "how it works" }, { href: "/pricing", label: "pricing" }, { href: "/sign-in", label: "sign in" }] },
    { title: "explore", links: [{ href: "/explore", label: "stories" }, { href: "/characters", label: "characters" }, { href: "/#examples", label: "examples" }] },
    { title: "learn", links: [{ href: "/docs", label: "docs" }, { href: "/pricing#credits", label: "how credits work" }, { href: "/#questions", label: "questions" }] },
    { title: "legal", links: [{ href: "/terms", label: "terms" }, { href: "/privacy", label: "privacy" }, { href: "/contact", label: "contact" }] },
  ];
  return (
    <footer className="mt-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/scenes/footer.jpg" alt="" className="block h-[120px] w-full object-cover object-bottom sm:h-[180px]" />
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 pb-8 pt-12 sm:px-6 md:grid-cols-[1.6fr_repeat(4,1fr)]">
        <div>
          <SiteLogo />
          <p className="mt-4 max-w-[260px] text-[15px] leading-relaxed text-fg-2">turn any idea into a whole world. animated, narrated, captioned videos from one sentence.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="mb-3 font-mono text-[13px] text-fg-3">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[15px] font-medium text-fg hover:text-fg-2">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-[1200px] px-5 pb-10 sm:px-6">
        <p className="font-mono text-[12.5px] leading-relaxed text-fg-3">
          the stories, characters and numbers on this page are samples made with the engine. not affiliated with roblox corporation or mojang studios.
        </p>
      </div>
    </footer>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { btn, Logo } from "@/components/ui";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/characters", label: "Characters" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();
  useEffect(() => {
    api<{ user: unknown }>("/api/me").then((d) => setSignedIn(!!d.user)).catch(() => setSignedIn(false));
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const create = signedIn ? "/studio" : "/sign-up?next=/studio";
  return (
    <header className={`sticky top-0 z-40 transition-colors ${scrolled || open ? "border-b border-line-soft bg-bg/90 backdrop-blur" : "border-b border-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="In My World home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-[7px] px-3 py-1.5 text-[14px] transition-colors hover:text-fg ${path === l.href ? "text-fg" : "text-fg-2"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Link href="/studio/projects" className={btn("ghost", "sm")}>
              My Studio
            </Link>
          ) : (
            <Link href="/sign-in" className={btn("ghost", "sm")}>
              Sign in
            </Link>
          )}
          <Link href={create} className={btn("primary", "sm")}>
            Create a video
          </Link>
        </div>
        <button className={btn("secondary", "sm", "md:hidden")} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu">
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="site-menu" className="border-t border-line-soft px-4 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-line-soft py-3 text-[16px] text-fg-2">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={signedIn ? "/studio/projects" : "/sign-in"} className={btn("secondary", "md")}>
              {signedIn ? "My Studio" : "Sign in"}
            </Link>
            <Link href={create} className={btn("primary", "md")}>
              Create a video
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const cols = [
    { title: "Product", links: [{ href: "/#how-it-works", label: "How it works" }, { href: "/#features", label: "Features" }, { href: "/studio", label: "Studio" }] },
    { title: "Explore", links: [{ href: "/explore", label: "Explore" }, { href: "/characters", label: "Characters" }, { href: "/#examples", label: "Examples" }] },
    { title: "Pricing", links: [{ href: "/pricing", label: "Plans" }, { href: "/pricing#credits", label: "How credits work" }] },
    { title: "Company", links: [{ href: "/docs", label: "Documentation" }, { href: "/contact", label: "Contact" }, { href: "/terms", label: "Terms" }, { href: "/privacy", label: "Privacy" }] },
  ];
  return (
    <footer className="mt-auto border-t border-line-soft">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-fg-2">Turn any idea into a whole world. Animated, narrated and captioned vertical videos from one sentence.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="eyebrow mb-3">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[13.5px] text-fg-2 hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 border-t border-line-soft px-4 py-6 text-[12px] text-fg-3 sm:flex-row sm:justify-between sm:px-6">
        <span>© 2026 In My World</span>
        <span>Not affiliated with, endorsed by or sponsored by Roblox Corporation or Mojang Studios.</span>
      </div>
    </footer>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MeProvider, useMe } from "@/lib/client/me";
import { api } from "@/lib/client/api";
import { btn, Logo } from "@/components/ui";
import { RenderAgentProvider, useRenderAgent } from "./render-agent";

const NAV = [
  { href: "/studio", label: "Create", exact: true },
  { href: "/studio/projects", label: "My Studio" },
  { href: "/studio/explore", label: "Explore" },
  { href: "/studio/characters", label: "Characters" },
  { href: "/studio/templates", label: "Templates" },
  { href: "/studio/billing", label: "Credits & billing" },
  { href: "/studio/settings", label: "Settings" },
];

const ICONS: Record<string, ReactNode> = {
  Create: <path d="M8 3v10M3 8h10" />,
  "My Studio": <path d="M2.5 3.5h11v9h-11zM2.5 6.5h11" />,
  Explore: <><circle cx="8" cy="8" r="5.5" /><path d="M10.2 5.8l-1.3 3.1-3.1 1.3 1.3-3.1z" /></>,
  Characters: <><rect x="5.5" y="2.5" width="5" height="4" rx="0.8" /><path d="M4 13.5v-4.5h8v4.5" /></>,
  Templates: <path d="M2.5 2.5h4.5v4.5h-4.5zM9 2.5h4.5v4.5h-4.5zM2.5 9h4.5v4.5h-4.5zM9 9h4.5v4.5h-4.5z" />,
  "Credits & billing": <><rect x="2" y="4" width="12" height="8.5" rx="1.2" /><path d="M2 7h12" /></>,
  Settings: <><circle cx="8" cy="8" r="2" /><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M3.6 12.4l1.4-1.4M11 5l1.4-1.4" /></>,
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Studio">
      {NAV.map((n) => {
        const on = n.exact ? path === n.href : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={`flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] transition-colors ${on ? "bg-bg-3 text-fg" : "text-fg-2 hover:bg-bg-3/60 hover:text-fg"}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden className={on && n.label === "Create" ? "text-accent" : ""}>
              {ICONS[n.label]}
            </svg>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AgentBadge() {
  const a = useRenderAgent();
  if (!a.jobId) return null;
  const pct = a.framesTotal ? Math.floor((a.framesDone / a.framesTotal) * 100) : 0;
  return (
    <Link href={`/studio/projects/${a.projectId}`} className="block rounded-[10px] border border-line bg-bg-2 p-3 text-[12.5px] hover:border-[var(--line-strong)]">
      <span className="flex items-center gap-2 font-medium text-fg">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
        Rendering in this tab
      </span>
      <span className="mt-1 block text-fg-2">{a.phase === "frames" ? `${a.framesDone} / ${a.framesTotal} frames · ${pct}%` : a.phase === "uploading" ? "Uploading MP4" : "Preparing"}</span>
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-bg-3">
        <span className="block h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}

function Account() {
  const { me, providers } = useMe();
  const router = useRouter();
  if (!me) return null;
  return (
    <div className="space-y-2">
      <AgentBadge />
      <Link href="/studio/billing" className="block rounded-[10px] border border-line bg-bg-2 p-3 hover:border-[var(--line-strong)]">
        <span className="flex items-baseline justify-between">
          <span className="text-[12px] text-fg-2">{me.plan.name} plan</span>
          <span className="font-mono text-[11px] text-fg-3">credits</span>
        </span>
        <span className="mt-0.5 block text-[22px] font-semibold tracking-[-0.03em]">{me.balance}</span>
      </Link>
      {providers?.mode === "development" && (
        <p className="rounded-[8px] border border-[var(--warn-line)] bg-[var(--warn-bg)] px-2.5 py-1.5 text-[11.5px] leading-snug text-[var(--warn-fg)]">
          Development mode · {providers.story.ai ? "AI story" : "template stories"}, {providers.voice.id === "macos-say" ? "system voices" : "no narration"}, in-browser rendering
        </p>
      )}
      <div className="flex items-center justify-between px-1 pt-1">
        <Link href="/studio/settings" className="min-w-0 truncate text-[13px] text-fg-2 hover:text-fg">
          {me.displayName}
        </Link>
        <button
          className="text-[12px] text-fg-3 hover:text-fg"
          onClick={async () => {
            await api("/api/auth/signout", { method: "POST" });
            router.replace("/");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!loading && !me) router.replace(`/sign-in?next=${encodeURIComponent(path)}`);
  }, [loading, me, router, path]);
  if (loading || !me)
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[13px] text-fg-3">
        {loading ? "Loading your studio…" : "Redirecting to sign in…"}
      </div>
    );
  return <>{children}</>;
}

function Frame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { me } = useMe();
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <RenderAgentProvider enabled={!!me}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line-soft bg-bg px-3 py-4 lg:flex">
          <Link href="/" className="mb-6 px-2">
            <Logo />
          </Link>
          <NavLinks />
          <div className="mt-auto">
            <Account />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line-soft bg-bg/90 px-4 backdrop-blur lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
            <div className="flex items-center gap-2">
              {me && (
                <Link href="/studio/billing" className="font-mono text-[12px] text-fg-2">
                  {me.balance} cr
                </Link>
              )}
              <button className={btn("secondary", "sm")} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="studio-drawer">
                Menu
              </button>
            </div>
          </header>
          {open && (
            <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" id="studio-drawer">
              <button className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 right-0 flex w-[min(300px,85vw)] flex-col border-l border-line bg-bg p-4">
                <NavLinks onNavigate={() => setOpen(false)} />
                <div className="mt-auto">
                  <Account />
                </div>
              </div>
            </div>
          )}
          <main className="min-w-0 flex-1">
            <Gate>{children}</Gate>
          </main>
        </div>
      </div>
    </RenderAgentProvider>
  );
}

export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <MeProvider>
      <Frame>{children}</Frame>
    </MeProvider>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{title}</h1>
        {sub && <p className="mt-1 text-[14px] text-fg-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

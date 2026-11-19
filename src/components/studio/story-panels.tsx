"use client";
import Link from "next/link";
import { useState } from "react";
import type { ChecklistItem, StorySheet } from "@/lib/engine/types";
import type { Metrics } from "@/lib/server/analytics";
import { Button, Tag } from "@/components/ui";

const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function sheetToText(sheet: StorySheet) {
  return [
    `A. The premise\n${sheet.premise}`,
    `B. The rule\n${sheet.rule}`,
    `   Why everyone obeys: ${sheet.whyObey}\n   When someone breaks it: ${sheet.breakConsequence}\n   Who benefits: ${sheet.beneficiary}\n   The secret: ${sheet.secret}`,
    `C. The protagonist\nMy name is ${sheet.protagonist.name}. ${sheet.protagonist.desire}\n   Vulnerability: ${sheet.protagonist.vulnerability}\n   Secret: ${sheet.protagonist.secret}`,
    `D. The conflict\n${sheet.conflict}`,
    `E. The escalation\n- First, ${sheet.escalation[0]}\n- Then, ${sheet.escalation[1]}\n- But things got worse when ${sheet.escalation[2]}`,
    `F. The mystery\n${sheet.mystery}`,
    `G. The twist (${label(sheet.twistType)})\n${sheet.twist}`,
    `H. The ending (${sheet.endingType === "open_loop" ? "open loop" : "closed loop"}, ${label(sheet.endingDevice)})\n${sheet.ending}`,
    `I. The continuation\n${sheet.continuation}`,
  ].join("\n\n");
}

export function StorySheetPanel({ sheet }: { sheet: StorySheet }) {
  const [copied, setCopied] = useState(false);
  const rows: [string, string, string?][] = [
    ["A", "Premise", sheet.premise],
    ["B", "Rule", sheet.rule],
    ["", "Why everyone obeys", sheet.whyObey],
    ["", "If you break it", sheet.breakConsequence],
    ["", "Who benefits", sheet.beneficiary],
    ["", "The secret", sheet.secret],
    ["C", "Protagonist", `${sheet.protagonist.name} — wants: ${sheet.protagonist.desire} Risks: ${sheet.protagonist.vulnerability} Hides: ${sheet.protagonist.secret}`],
    ["D", "Conflict", sheet.conflict],
    ["E", "Escalation", sheet.escalation.map((e, i) => `${["Curiosity", "Concern", "Urgency"][i]}: ${e}`).join("\n")],
    ["F", "Mystery", sheet.mystery],
    ["G", `Twist · ${label(sheet.twistType)}`, sheet.twist],
    ["H", `Ending · ${sheet.endingType === "open_loop" ? "open loop" : "closed loop"} · ${label(sheet.endingDevice)}`, sheet.ending],
    ["I", "Continuation", sheet.continuation],
  ];
  return (
    <section className="rounded-[12px] border border-line-soft bg-bg-2">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 className="text-body font-semibold">Story sheet</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(sheetToText(sheet)).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <dl className="divide-y divide-line-soft">
        {rows.map(([letter, k, v]) => (
          <div key={k} className="grid grid-cols-[22px_120px_1fr] gap-2 px-4 py-2.5 text-small">
            <dt className="font-mono text-micro leading-5 text-accent">{letter}</dt>
            <dt className="leading-5 text-fg-3">{k}</dt>
            <dd className="whitespace-pre-line leading-5 text-fg-2">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ChecklistPanel({ items, source, revised }: { items: ChecklistItem[]; source?: string; revised?: boolean }) {
  const passed = items.filter((i) => i.pass === true).length;
  return (
    <section className="rounded-[12px] border border-line-soft bg-bg-2">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <h2 className="text-body font-semibold">Editorial checklist</h2>
        <span className="text-caption text-fg-3">
          {passed}/{items.length} · {source === "editor" ? `AI editor${revised ? ", revised once" : ""}` : "structure checks"}
        </span>
      </div>
      <ul className="divide-y divide-line-soft">
        {items.map((i) => (
          <li key={i.key} className="flex gap-3 px-4 py-2.5 text-small">
            <span
              aria-label={i.pass === true ? "Pass" : i.pass === false ? "Needs work" : "Needs a human read"}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-micro font-bold ${i.pass === true ? "bg-accent text-accent-ink" : i.pass === false ? "bg-danger text-bg" : "border border-line text-fg-3"}`}
            >
              {i.pass === true ? "✓" : i.pass === false ? "!" : "?"}
            </span>
            <span className="min-w-0">
              <span className="block text-fg">{i.label}</span>
              {i.note && <span className="mt-0.5 block leading-snug text-fg-3">{i.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      {source !== "editor" && <p className="border-t border-line-soft px-4 py-2.5 text-micro text-fg-3">Structure checks confirm the shape of the story. Items marked ? need an editor — configure Claude to have them graded automatically.</p>}
    </section>
  );
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const secs = (x: number | null) => (x === null ? "—" : `${x.toFixed(1)}s`);

export function MetricsPanel({ m, isPublic }: { m: Metrics; isPublic: boolean }) {
  const rows: [string, string, string][] = [
    ["Views", String(m.views), "Unique viewers"],
    ["First 3-second retention", pct(m.retention3s), "Is the hook working?"],
    ["Average watch time", `${secs(m.avgWatchSec)}${m.durationSec ? ` of ${m.durationSec.toFixed(0)}s` : ""}`, "Is the story holding attention?"],
    ["Completion rate", pct(m.completionRate), "Are people reaching the ending?"],
    ["Rewatches", String(m.rewatches), "Worth revisiting?"],
    ["Shares", String(m.shares), "Compelling enough to pass on?"],
    ["Returning viewers", String(m.returningViewers), "Watched another of your videos"],
  ];
  return (
    <section className="rounded-[12px] border border-line-soft bg-bg-2">
      <div className="border-b border-line-soft px-4 py-3">
        <h2 className="text-body font-semibold">Performance</h2>
        <p className="mt-0.5 text-caption text-fg-3">Plays inside In My World (share page and Explore). Your own plays and plays on other platforms aren’t counted.</p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-line-soft sm:grid-cols-3">
        {rows.map(([k, v, hint]) => (
          <div key={k} className="bg-bg-2 px-4 py-3">
            <dt className="text-micro text-fg-3">{k}</dt>
            <dd className="mt-0.5 text-title font-semibold tracking-[-0.02em]">{v}</dd>
            <dd className="text-micro text-fg-3">{hint}</dd>
          </div>
        ))}
        <div className="bg-bg-2 px-4 py-3">
          <dt className="text-micro text-fg-3">Comments</dt>
          <dd className="mt-1 text-caption leading-snug text-fg-3">Not available — there are no comments yet.</dd>
        </div>
      </dl>
      {!isPublic && m.views === 0 && <p className="border-t border-line-soft px-4 py-2.5 text-caption text-fg-3">Share the video to start collecting audience data.</p>}
    </section>
  );
}

export function SeriesStrip({ episodes, current }: { episodes: { id: string; episode: number; title: string; status: string }[]; current: string }) {
  if (episodes.length < 2) return null;
  return (
    <nav aria-label="Episodes" className="flex flex-wrap gap-1.5">
      {episodes.map((e) => (
        <Link
          key={e.id}
          href={`/studio/projects/${e.id}`}
          aria-current={e.id === current ? "page" : undefined}
          className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-caption ${e.id === current ? "border-accent bg-[var(--accent-soft)] text-fg" : "border-line-soft text-fg-2 hover:border-line hover:text-fg"}`}
        >
          Part {e.episode}
          {e.status !== "completed" && <Tag>{e.status === "failed" ? "failed" : "in progress"}</Tag>}
        </Link>
      ))}
    </nav>
  );
}

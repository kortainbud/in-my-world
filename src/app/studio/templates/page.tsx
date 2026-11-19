import Link from "next/link";
import { CATEGORIES, TEMPLATES } from "@/config/site";
import { CHECKLIST } from "@/lib/engine/checklist";
import { SheetTemplate } from "@/components/studio/sheet-template";

// Client-rendered behind the studio auth gate.
export const instant = false;

const FORMAT_LABEL = { strange_world: "Strange world", mystery_series: "Mystery series", impossible_choice: "Impossible choice" } as const;

export default function TemplatesPage() {
  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
      <h1 className="text-page font-semibold">Templates</h1>
      <p className="mt-1 max-w-2xl text-body text-fg-2">
        Every story needs a rule, a reason to care, something that threatens the rule, and a twist that changes everything.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <SheetTemplate />
        <div className="space-y-4">
          <section className="rounded-[12px] border border-line-soft bg-bg-2 p-4">
            <h2 className="text-body font-semibold">Three formats</h2>
            <dl className="mt-3 space-y-3 text-small">
              <div><dt className="font-medium">A · Strange world <span className="text-micro font-normal text-fg-3">foundation</span></dt><dd className="text-fg-2">One strange rule governs a society. Someone breaks it, and consequences follow. Best for standalone, shareable premises.</dd></div>
              <div><dt className="font-medium">B · Mystery series</dt><dd className="text-fg-2">Every episode reveals another piece of a larger mystery and ends open. Use “Make Part 2” on a finished video.</dd></div>
              <div><dt className="font-medium">C · Impossible choice</dt><dd className="text-fg-2">Two options, each with a cost. The video ends on the choice, shown on screen.</dd></div>
            </dl>
          </section>
          <section className="rounded-[12px] border border-line-soft bg-bg-2 p-4">
            <h2 className="text-body font-semibold">Editorial checklist</h2>
            <ul className="mt-3 space-y-1.5 text-small text-fg-2">
              {CHECKLIST.map((c) => (
                <li key={c.key} className="flex gap-2"><span className="text-accent">□</span>{c.label}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="mt-12 space-y-10">
        {CATEGORIES.map((cat) => {
          const list = TEMPLATES.filter((t) => t.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="eyebrow mb-3">
                {cat}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {list.map((t) => (
                  <Link
                    key={t.id}
                    href={`/studio?prompt=${encodeURIComponent(t.prompt)}${t.format ? `&format=${t.format}` : ""}`}
                    className="group flex items-center justify-between gap-4 rounded-[12px] border border-line-soft bg-bg-2 p-4 transition-colors hover:border-line"
                  >
                    <span className="min-w-0">
                      <span className="block text-body font-medium">{t.title}</span>
                      <span className="mt-1 block text-small leading-snug text-fg-2">{t.prompt}</span>
                      {t.format && <span className="mt-2 inline-block text-micro text-fg-3">{FORMAT_LABEL[t.format]}</span>}
                    </span>
                    <span className="shrink-0 rounded-[7px] border border-line px-2.5 py-1 text-caption text-fg-2 transition-colors group-hover:border-accent group-hover:text-fg">Use</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

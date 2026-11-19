import Link from "next/link";
import { CATEGORIES, TEMPLATES } from "@/config/site";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function TemplatesPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-20 pt-6 sm:px-6 lg:pt-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Templates</h1>
      <p className="mt-1 text-[14px] text-fg-2">Proven story rules. Pick one, change anything, make it yours.</p>
      <div className="mt-8 space-y-10">
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
                    href={`/studio?prompt=${encodeURIComponent(t.prompt)}`}
                    className="group flex items-center justify-between gap-4 rounded-[12px] border border-line-soft bg-bg-2 p-4 transition-colors hover:border-line"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">{t.title}</span>
                      <span className="mt-1 block text-[13px] leading-snug text-fg-2">{t.prompt}</span>
                    </span>
                    <span className="shrink-0 rounded-[7px] border border-line px-2.5 py-1 text-[12.5px] text-fg-2 transition-colors group-hover:border-accent group-hover:text-fg">Use</span>
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

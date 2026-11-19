import type { ReactNode } from "react";

export function Prose({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[760px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="display text-display-sm lowercase sm:text-display">{title}.</h1>
      {lead && <p className="mt-4 text-lead leading-relaxed text-fg-2">{lead}</p>}
      <div className="mt-10 space-y-5 text-body leading-relaxed text-fg-2 [&_a]:text-fg [&_a]:underline [&_a]:decoration-line [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-title [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-fg">
        {children}
      </div>
    </article>
  );
}

export function DraftNotice() {
  return (
    <p className="rounded-[10px] border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3 text-small text-[var(--warn-fg)]">
      Draft. This page is a placeholder outline and is not yet legally binding. Final terms will be reviewed and published before launch.
    </p>
  );
}

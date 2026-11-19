"use client";
import { useState } from "react";
import { Button } from "@/components/ui";

export const SHEET_TEMPLATE = `A. The premise
In my town, ______.

B. The rule
Everyone must ______, otherwise ______.
- Why does everyone obey it? ______
- What happens when someone breaks it? ______
- Who benefits from the rule? ______
- What is the secret behind the rule? ______

C. The protagonist
My name is ______. All I want is ______.
(Desire / vulnerability / secret)

D. The conflict
But one day, ______.

E. The escalation
- First, ______.
- Then, ______.
- But things got worse when ______.

F. The mystery
I started noticing that ______.

G. The twist
But the truth was ______.

H. The ending
And just when I thought it was over, ______.

I. The continuation
Then I received a message saying ______.`;

export function SheetTemplate() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-[12px] border border-line-soft bg-bg-2">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div>
          <h2 className="text-body font-semibold">Story development sheet</h2>
          <p className="text-caption text-fg-2">The template every story is built on. Every finished video shows its own filled-in sheet.</p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(SHEET_TEMPLATE).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? "Copied" : "Copy template"}
        </Button>
      </div>
      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-caption leading-relaxed text-fg-2">{SHEET_TEMPLATE}</pre>
    </div>
  );
}

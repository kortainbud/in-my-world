import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioShell } from "@/components/studio/shell";
import { THEME_SCRIPT } from "@/components/site/fx";

export const metadata: Metadata = { title: "Studio", robots: { index: false } };

// The studio is a client-rendered app shell that fetches per-user data from the API.
export const instant = false;

export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <div className="theme-light min-h-screen">
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <Suspense fallback={null}>
        <StudioShell>{children}</StudioShell>
      </Suspense>
    </div>
  );
}

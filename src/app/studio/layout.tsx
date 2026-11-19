import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioShell } from "@/components/studio/shell";

export const metadata: Metadata = { title: "Studio", robots: { index: false } };

// The studio is a client-rendered app shell that fetches per-user data from the API.
export const instant = false;

export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <Suspense fallback={null}>
      <StudioShell>{children}</StudioShell>
    </Suspense>
  );
}

import { Suspense } from "react";
import { SiteFooter, SiteNav } from "@/components/site/chrome";
import { THEME_SCRIPT, WorldLoader } from "@/components/site/fx";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="theme-light relative isolate flex min-h-screen flex-col">
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <WorldLoader />
      <Suspense fallback={<div className="h-[75px]" />}>
        <SiteNav />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <SiteFooter />
      </Suspense>
    </div>
  );
}

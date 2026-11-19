import { Suspense } from "react";
import { SiteFooter, SiteNav } from "@/components/site/chrome";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="theme-light flex min-h-screen flex-col">
      <Suspense fallback={<div className="h-[75px]" />}>
        <SiteNav />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

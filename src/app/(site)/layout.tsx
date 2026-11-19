import { Suspense } from "react";
import { SiteFooter, SiteNav } from "@/components/site/chrome";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<div className="h-16" />}>
        <SiteNav />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}

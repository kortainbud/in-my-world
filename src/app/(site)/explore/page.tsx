import type { Metadata } from "next";
import { Suspense } from "react";
import { Explore } from "@/components/explore";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="display text-[44px] sm:text-[64px]">explore.</h1>
      <p className="mt-3 max-w-lg text-[15px] text-fg-2">Stories people are making — and sample videos from the engine, labelled as samples.</p>
      <div className="mt-10">
        <Suspense fallback={null}>
          <Explore context="public" />
        </Suspense>
      </div>
    </div>
  );
}

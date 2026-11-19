import { Suspense } from "react";
import { Explore } from "@/components/explore";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function StudioExplore() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-24 pt-8 sm:px-8 lg:pt-12">
      <h1 className="mb-8 text-page font-semibold">Explore</h1>
      <Suspense fallback={null}>
        <Explore context="studio" />
      </Suspense>
    </div>
  );
}

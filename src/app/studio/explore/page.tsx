import { Suspense } from "react";
import { Explore } from "@/components/explore";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function StudioExplore() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 lg:pt-10">
      <h1 className="mb-6 text-[26px] font-semibold tracking-[-0.03em]">Explore</h1>
      <Suspense fallback={null}>
        <Explore context="studio" />
      </Suspense>
    </div>
  );
}

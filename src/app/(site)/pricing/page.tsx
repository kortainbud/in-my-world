import type { Metadata } from "next";
import { FAQ, Pricing } from "@/components/site/pricing";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-12 sm:px-6">
      <h1 className="display text-display-sm sm:text-display">pricing.</h1>
      <p className="mb-12 mt-3 max-w-lg text-body text-fg-2">Start free with monthly credits. Upgrade for longer videos, 1080p and no watermark.</p>
      <Pricing />
      <h2 className="mb-5 mt-20 text-title font-semibold tracking-[-0.02em]">questions.</h2>
      <FAQ />
    </div>
  );
}

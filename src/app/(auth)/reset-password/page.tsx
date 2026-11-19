import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPassword } from "@/components/password-reset";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

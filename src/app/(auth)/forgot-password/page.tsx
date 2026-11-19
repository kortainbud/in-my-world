import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPassword } from "@/components/password-reset";

export const metadata: Metadata = { title: "Reset your password" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForgotPassword />
    </Suspense>
  );
}

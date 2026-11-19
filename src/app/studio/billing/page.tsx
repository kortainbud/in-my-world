import { BillingScreen } from "@/components/studio/pages/billing";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function Page() {
  return <BillingScreen />;
}

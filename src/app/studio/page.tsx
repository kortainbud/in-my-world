import { Suspense } from "react";
import { CreateScreen } from "@/components/studio/create";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateScreen />
    </Suspense>
  );
}

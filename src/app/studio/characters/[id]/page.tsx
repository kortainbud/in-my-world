import { Suspense } from "react";
import { EditCharacterRoute } from "@/components/studio/pages/edit-character-route";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EditCharacterRoute />
    </Suspense>
  );
}

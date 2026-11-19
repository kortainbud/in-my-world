import { Suspense } from "react";
import { ProjectRoute } from "@/components/studio/pages/project-route";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProjectRoute />
    </Suspense>
  );
}

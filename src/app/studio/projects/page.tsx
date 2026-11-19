import { Suspense } from "react";
import { ProjectsScreen } from "@/components/studio/projects";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsScreen />
    </Suspense>
  );
}

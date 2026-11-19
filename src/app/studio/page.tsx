import { Suspense } from "react";
import { CreateScreen } from "@/components/studio/create";

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateScreen />
    </Suspense>
  );
}

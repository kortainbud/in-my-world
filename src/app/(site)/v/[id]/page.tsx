import { Suspense } from "react";
import { ShareRoute } from "@/components/site/share-route";

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <ShareRoute />
    </Suspense>
  );
}

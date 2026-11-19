import { Suspense } from "react";
import { CharactersScreen } from "@/components/studio/characters";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function CharactersPage() {
  return (
    <Suspense fallback={null}>
      <CharactersScreen />
    </Suspense>
  );
}

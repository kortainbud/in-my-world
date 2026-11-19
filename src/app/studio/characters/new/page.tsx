import { Builder } from "@/components/studio/builder";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function NewCharacter() {
  return <Builder />;
}

import { SettingsScreen } from "@/components/studio/pages/settings";

// Client-rendered behind the studio auth gate.
export const instant = false;

export default function Page() {
  return <SettingsScreen />;
}

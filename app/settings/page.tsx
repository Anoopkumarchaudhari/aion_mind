import { Suspense } from "react";
import { SettingsPageContent } from "@/components/SettingsPageContent";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  );
}

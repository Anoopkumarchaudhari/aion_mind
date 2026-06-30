import { Suspense } from "react";
import { StudioHubContent } from "@/components/StudioHubContent";

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioHubContent />
    </Suspense>
  );
}

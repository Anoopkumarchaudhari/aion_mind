import { Suspense } from "react";
import { StudioHubContent } from "@/components/StudioHubContent";

export default function StudioCreatePage() {
  return (
    <Suspense fallback={null}>
      <StudioHubContent />
    </Suspense>
  );
}

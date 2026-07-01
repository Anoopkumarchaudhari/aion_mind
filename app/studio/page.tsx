import { Suspense } from "react";
import { StudioLanding } from "@/components/StudioLanding";

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioLanding />
    </Suspense>
  );
}

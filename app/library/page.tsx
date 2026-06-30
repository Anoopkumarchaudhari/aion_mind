import { Suspense } from "react";
import { LibraryPageContent } from "@/components/LibraryPageContent";

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPageContent />
    </Suspense>
  );
}

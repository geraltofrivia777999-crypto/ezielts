import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TestsCatalogClient } from "./_components/tests-catalog-client";

export default function TestsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[rgb(var(--background))] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--primary))]" />
        </div>
      }
    >
      <TestsCatalogClient />
    </Suspense>
  );
}

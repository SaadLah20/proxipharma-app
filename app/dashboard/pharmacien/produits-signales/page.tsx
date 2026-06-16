import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PharmacistCatalogReportsHub } from "@/components/pharmacist/pharmacist-catalog-reports-hub";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Chargement…
    </div>
  );
}

export default function PharmacistCatalogReportsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PharmacistCatalogReportsHub />
    </Suspense>
  );
}

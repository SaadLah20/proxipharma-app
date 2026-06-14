"use client";

import { Suspense } from "react";
import AdminOfficinesPage from "./officines-content";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <AdminOfficinesPage />
    </Suspense>
  );
}

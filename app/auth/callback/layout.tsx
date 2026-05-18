import { Suspense } from "react";

export default function AuthCallbackLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-6 text-center text-sm text-muted-foreground">Chargement…</p>}>{children}</Suspense>;
}

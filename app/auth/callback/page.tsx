"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { defaultPathAfterAuth } from "@/lib/post-auth-redirect";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Point d’atterrissage des liens e-mail Supabase (confirmation, changement d’e-mail).
 * `detectSessionInUrl` dans `lib/supabase.ts` échange le hash / query avant redirection.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next")?.trim() ?? "";
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "";
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hasAuthFragment =
        hash.includes("access_token=") ||
        hash.includes("error=") ||
        hash.includes("type=recovery");

      if (hasAuthFragment) {
        await new Promise((r) => setTimeout(r, 150));
      }

      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionErr) {
        setError(sessionErr.message);
        return;
      }

      if (data.session) {
        if (safeNext) {
          router.replace(safeNext);
          return;
        }
        const path = await defaultPathAfterAuth();
        router.replace(path);
        return;
      }

      const type = searchParams.get("type");
      if (type === "recovery" || hash.includes("type=recovery")) {
        router.replace("/auth/update-password");
        return;
      }

      setError(
        "Lien expiré ou déjà utilisé. Demandez un nouveau code ou un nouveau lien depuis l’application."
      );
    };

    void run();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session) return;
      if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "USER_UPDATED") {
        if (safeNext) {
          router.replace(safeNext);
        } else if (event === "PASSWORD_RECOVERY") {
          router.replace("/auth/update-password");
        } else {
          void defaultPathAfterAuth().then((path) => router.replace(path));
        }
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router, safeNext, searchParams]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      {error ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
          <p className="text-destructive">{error}</p>
          <Link href="/auth" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          Finalisation de la connexion…
        </p>
      )}
    </main>
  );
}

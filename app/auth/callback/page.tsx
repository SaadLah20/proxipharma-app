"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { defaultPathAfterAuth } from "@/lib/post-auth-redirect";
import { userNeedsSignupPassword } from "@/lib/auth-signup-flow";
import { AUTH_CALLBACK_LINK_EXPIRED } from "@/lib/auth-messages-fr";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Atterrissage des liens e-mail Supabase (récupération MDP, changement d’e-mail, éventuel lien inscription).
 * `detectSessionInUrl` échange le hash / query avant redirection.
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

    const routeAfterSession = async () => {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionErr) {
        setError(sessionErr.message);
        return;
      }

      const user = data.session?.user;
      if (!user) return false;

      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const isRecovery =
        searchParams.get("type") === "recovery" || hash.includes("type=recovery");

      if (isRecovery) {
        router.replace("/auth/update-password");
        return true;
      }

      if (userNeedsSignupPassword(user)) {
        router.replace("/auth?mode=signup&step=password&from=link");
        return true;
      }

      if (safeNext) {
        router.replace(safeNext);
        return true;
      }

      const path = await defaultPathAfterAuth();
      router.replace(path);
      return true;
    };

    const run = async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hasAuthFragment =
        hash.includes("access_token=") ||
        hash.includes("error=") ||
        hash.includes("type=recovery");

      if (hasAuthFragment) {
        await new Promise((r) => setTimeout(r, 200));
      }

      const routed = await routeAfterSession();
      if (cancelled) return;

      if (!routed) {
        setError(AUTH_CALLBACK_LINK_EXPIRED);
      }
    };

    void run();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session?.user) return;
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/update-password");
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void routeAfterSession();
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
          <Link href="/auth?mode=signup" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
            Créer un compte / connexion
          </Link>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          Finalisation…
        </p>
      )}
    </main>
  );
}

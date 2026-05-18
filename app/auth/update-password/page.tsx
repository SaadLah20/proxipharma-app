"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function AuthUpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    if (password.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== password2) {
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Mot de passe mis à jour. Redirection…");
    router.replace("/auth");
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <Link
        href="/auth"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 -ml-2 w-fit gap-1.5 px-2 text-sm font-semibold text-primary"
        )}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à la connexion
      </Link>

      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Définissez un nouveau mot de passe pour votre compte (lien de récupération e-mail).
        </p>

        {!ready ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            Vérification du lien…
          </p>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={(ev) => void handleSubmit(ev)}>
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirmer le mot de passe"
              className={fieldClass}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={loading} className="mt-1 h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Patientez…
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </form>
        )}

        {message ? (
          <p
            className={cn(
              "mt-4 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              message.includes("mis à jour")
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                : "border-border bg-muted/50 text-foreground"
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}

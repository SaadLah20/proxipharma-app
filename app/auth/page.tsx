"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cross, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { defaultPathAfterAuth } from "@/lib/post-auth-redirect";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function AuthForm({ initialLogin }: { initialLogin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect")?.trim() || "";
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "";

  const [isLogin, setIsLogin] = useState(initialLogin);
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const dest = safeRedirect || (await defaultPathAfterAuth());
        router.replace(dest);
      }
    };

    void checkSession();
  }, [router, safeRedirect]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!isLogin && whatsapp.trim().length < 8) {
      setMessage("Le numéro WhatsApp est obligatoire et doit être valide.");
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        const dest = safeRedirect || (await defaultPathAfterAuth());
        router.push(dest);
      }
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          whatsapp,
        },
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Compte créé. Vérifiez votre e-mail si la confirmation est activée, puis connectez-vous.");
      setIsLogin(true);
    }

    setLoading(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 -ml-2 w-fit gap-1.5 px-2 text-sm font-semibold text-primary"
        )}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à l&apos;annuaire
      </Link>

      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary" aria-hidden>
            <Cross className="size-5" strokeWidth={2.25} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {isLogin ? "Connexion" : "Créer un compte patient"}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Accédez à vos demandes de produits et au suivi avec votre pharmacie. Le numéro WhatsApp est requis à
              l&apos;inscription pour faciliter le contact officinal.
            </p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Nom complet"
                className={fieldClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              <input
                type="text"
                placeholder="WhatsApp (obligatoire)"
                className={fieldClass}
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                required
                autoComplete="tel"
              />
            </>
          )}

          <input
            type="email"
            placeholder="E-mail"
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Mot de passe"
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />

          <Button type="submit" disabled={loading} className="mt-1 h-11 w-full gap-2 text-sm">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Patientez…
              </>
            ) : isLogin ? (
              "Se connecter"
            ) : (
              "Créer le compte"
            )}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsLogin((v) => !v);
            setMessage("");
          }}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "mt-3 h-auto w-full py-2 text-sm font-semibold text-primary"
          )}
        >
          {isLogin ? "Pas de compte ? Inscription" : "Déjà un compte ? Connexion"}
        </button>

        {message ? (
          <p
            className={cn(
              "mt-4 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              message.toLowerCase().includes("créé") || message.toLowerCase().includes("créée")
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

function AuthFormGate() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const initialLogin = mode !== "signup";
  return <AuthForm key={mode ?? "login"} initialLogin={initialLogin} />;
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center gap-2 bg-background p-6 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
          <span className="text-sm font-medium text-foreground">Chargement…</span>
        </main>
      }
    >
      <AuthFormGate />
    </Suspense>
  );
}

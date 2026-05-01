"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect")?.trim() || "";
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "";

  const [isLogin, setIsLogin] = useState(true);
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
        router.replace(safeRedirect || "/dashboard");
      }
    };

    void checkSession();
  }, [router, safeRedirect]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!isLogin && whatsapp.trim().length < 8) {
      setMessage("Le numero WhatsApp est obligatoire et doit etre valide.");
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        router.push(safeRedirect || "/dashboard");
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
      setMessage("Compte cree. Verifie ton email si confirmation activee, puis connecte-toi.");
      setIsLogin(true);
    }

    setLoading(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <Link href="/" className="mb-6 text-sm text-blue-700 underline">
        Retour a l annuaire
      </Link>
      <h1 className="mb-2 text-2xl font-bold">{isLogin ? "Connexion" : "Creer un compte patient"}</h1>
      <p className="mb-6 text-sm text-gray-600">
        Sprint 1: authentification simple. WhatsApp est obligatoire a l inscription.
      </p>

      <form className="space-y-3" onSubmit={handleSubmit}>
        {!isLogin && (
          <>
            <input
              type="text"
              placeholder="Nom complet"
              className="w-full rounded-lg border p-3"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              type="text"
              placeholder="WhatsApp (obligatoire)"
              className="w-full rounded-lg border p-3"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
            />
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-lg border p-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          className="w-full rounded-lg border p-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 p-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Chargement..." : isLogin ? "Se connecter" : "Creer le compte"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setIsLogin((v) => !v);
          setMessage("");
        }}
        className="mt-4 text-sm text-blue-700 underline"
      >
        {isLogin ? "Pas de compte ? Inscription" : "Deja un compte ? Connexion"}
      </button>

      {message ? <p className="mt-4 text-sm text-gray-700">{message}</p> : null}
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6 text-gray-600">Chargement...</main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}

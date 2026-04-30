"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TestState = {
  status: "idle" | "running" | "success" | "error";
  message: string;
  insertedId?: string;
  insertedName?: string;
};

export default function RlsDebugPage() {
  const [state, setState] = useState<TestState>({
    status: "idle",
    message: "Clique sur 'Tester insertion products'.",
  });
  const [isCleaning, setIsCleaning] = useState(false);

  const stateColor = useMemo(() => {
    if (state.status === "success") return "text-green-700 bg-green-50 border-green-200";
    if (state.status === "error") return "text-red-700 bg-red-50 border-red-200";
    return "text-gray-700 bg-gray-50 border-gray-200";
  }, [state.status]);

  const runInsertTest = async () => {
    setState({ status: "running", message: "Test en cours..." });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setState({
        status: "error",
        message: "Tu dois etre connecte pour lancer ce test.",
      });
      return;
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      setState({
        status: "error",
        message: `Impossible de lire le role utilisateur: ${profileError.message}`,
      });
      return;
    }

    const now = Date.now();
    const random = Math.floor(Math.random() * 100000);
    const testName = `RLS_TEST_${now}_${random}`;

    const { data, error } = await supabase
      .from("products")
      .insert({
        name: testName,
        product_type: "medicament",
      })
      .select("id, name")
      .single();

    if (error) {
      setState({
        status: "error",
        message: `Insertion REFUSEE (attendu pour non-admin): ${error.message}`,
      });
      return;
    }

    setState({
      status: "success",
      message: `Insertion AUTORISEE (attendu pour admin). Role detecte: ${profile?.role ?? "inconnu"}`,
      insertedId: data.id,
      insertedName: data.name,
    });
  };

  const cleanupTests = async () => {
    setIsCleaning(true);
    const { error } = await supabase.from("products").delete().ilike("name", "RLS_TEST_%");
    setIsCleaning(false);

    if (error) {
      setState({
        status: "error",
        message: `Nettoyage echoue: ${error.message}`,
      });
      return;
    }

    setState({
      status: "idle",
      message: "Nettoyage termine (produits RLS_TEST supprimes).",
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-blue-900">Debug RLS products</h1>
        <p className="mt-2 text-sm text-gray-600">
          Cette page teste l'insertion dans <code>products</code> avec l'utilisateur actuellement connecte.
        </p>

        <div className="mt-4 rounded-lg border p-3 text-sm">
          <p>
            - Si tu es non-admin: l'insertion doit etre refusee.
          </p>
          <p>
            - Si tu es admin: l'insertion doit etre autorisee.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={runInsertTest}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Tester insertion products
          </button>
          <button
            onClick={cleanupTests}
            disabled={isCleaning}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {isCleaning ? "Nettoyage..." : "Nettoyer les RLS_TEST"}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700"
          >
            Retour accueil
          </Link>
        </div>

        <div className={`mt-6 rounded-lg border p-3 text-sm ${stateColor}`}>
          <p>{state.message}</p>
          {state.insertedId ? <p className="mt-1">ID insere: {state.insertedId}</p> : null}
          {state.insertedName ? <p>Nom insere: {state.insertedName}</p> : null}
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminCommunityProductsPanel } from "@/components/admin/admin-community-products-panel";
import { supabase } from "@/lib/supabase";

export default function AdminCommunityProductsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.replace("/");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    void init();
  }, [router]);

  if (loading) {
    return <main className="min-h-screen p-6">Chargement...</main>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produits communautaires</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enrichir et publier au catalogue national les produits créés par les officines.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-blue-700 underline">
          Retour panneau admin
        </Link>
      </div>

      <AdminCommunityProductsPanel />
    </main>
  );
}

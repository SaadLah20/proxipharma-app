"use client";

import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { AdminCommunityProductsPanel } from "@/components/admin/admin-community-products-panel";

export default function AdminCommunityProductsPage() {
  return (
    <div className="space-y-4">
      <AdminAccountPageHeader
        title="Produits communautaires"
        subtitle="Enrichir et publier au catalogue national les produits créés par les officines."
      />
      <AdminCommunityProductsPanel />
    </div>
  );
}

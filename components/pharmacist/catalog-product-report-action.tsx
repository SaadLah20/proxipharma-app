"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Flag } from "lucide-react";
import { CatalogProductReportModal } from "@/components/pharmacist/catalog-product-report-modal";
import {
  activeReportBadgeLabelFr,
  type ActiveCatalogProductReportSummary,
} from "@/lib/catalog-product-report-types";
import { useCatalogProductReportRefresh } from "@/lib/catalog-product-report-status-provider";

export function CatalogProductReportAction({
  productId,
  productName,
  activeReport,
  variant = "icon",
  className,
  onOpenExisting,
}: {
  productId: string;
  productName: string;
  activeReport?: ActiveCatalogProductReportSummary | null;
  variant?: "icon" | "pill";
  className?: string;
  onOpenExisting?: (reportId: string) => void;
}) {
  const router = useRouter();
  const { bumpRefresh } = useCatalogProductReportRefresh();
  const [modalOpen, setModalOpen] = useState(false);
  const [editReportId, setEditReportId] = useState<string | null>(null);

  const navigateToReport = (reportId: string) => {
    router.push(`/dashboard/pharmacien/produits-signales?report=${reportId}`);
  };

  const handleOpenCreate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setEditReportId(null);
    setModalOpen(true);
  };

  const handleOpenExisting = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!activeReport) return;
    if (onOpenExisting) {
      onOpenExisting(activeReport.report_id);
      return;
    }
    if (activeReport.status === "awaiting_pharmacist") {
      navigateToReport(activeReport.report_id);
      return;
    }
    setEditReportId(activeReport.report_id);
    setModalOpen(true);
  };

  const handleSaved = () => {
    bumpRefresh();
  };

  if (activeReport) {
    const label = activeReportBadgeLabelFr(activeReport.status);
    const isAwaiting = activeReport.status === "awaiting_pharmacist";

    if (variant === "pill") {
      return (
        <>
          <button
            type="button"
            className={clsx(
              "rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold",
              isAwaiting
                ? "border-amber-300/80 bg-amber-50 text-amber-950"
                : "border-slate-300/80 bg-slate-50 text-slate-800",
              className
            )}
            onClick={handleOpenExisting}
            title={isAwaiting ? "Traitement à valider" : "Déjà signalé — en cours de traitement"}
          >
            {label}
          </button>
          {modalOpen && editReportId ? (
            <CatalogProductReportModal
              open
              productId={productId}
              productName={productName}
              reportId={editReportId}
              onClose={() => setModalOpen(false)}
              onSaved={handleSaved}
            />
          ) : null}
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          className={clsx(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold",
            isAwaiting
              ? "border-amber-300/80 bg-amber-50 text-amber-900"
              : "border-slate-300/80 bg-slate-50 text-slate-700",
            className
          )}
          onClick={handleOpenExisting}
          aria-label={isAwaiting ? "Traitement à valider" : "Produit déjà signalé"}
          title={isAwaiting ? "Traitement à valider" : "Déjà signalé — en cours de traitement"}
        >
          {isAwaiting ? "!" : "✓"}
        </button>
        {modalOpen && editReportId ? (
          <CatalogProductReportModal
            open
            productId={productId}
            productName={productName}
            reportId={editReportId}
            onClose={() => setModalOpen(false)}
            onSaved={handleSaved}
          />
        ) : null}
      </>
    );
  }

  if (variant === "pill") {
    return (
      <>
        <button
          type="button"
          className={clsx(
            "rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/40",
            className
          )}
          onClick={handleOpenCreate}
        >
          Signaler
        </button>
        {modalOpen ? (
          <CatalogProductReportModal
            open
            productId={productId}
            productName={productName}
            onClose={() => setModalOpen(false)}
            onSaved={handleSaved}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className={clsx(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          className
        )}
        onClick={handleOpenCreate}
        aria-label="Signaler une erreur catalogue"
        title="Signaler une erreur catalogue"
      >
        <Flag className="size-3.5" aria-hidden />
      </button>
      {modalOpen ? (
        <CatalogProductReportModal
          open
          productId={productId}
          productName={productName}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  );
}

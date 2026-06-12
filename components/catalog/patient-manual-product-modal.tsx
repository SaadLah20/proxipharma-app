"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { normalizeManualProductLabel } from "@/lib/patient-manual-product-line";
import { cn } from "@/lib/utils";

export function PatientManualProductModal({
  open,
  initialName = "",
  onClose,
  onConfirm,
}: {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const td = useTranslations("demandePublic");
  const tc = useTranslations("common");
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");

  const reset = () => {
    setName(initialName);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = normalizeManualProductLabel(name);
    if (trimmed.length < 2) {
      setError(td("manualProductNameTooShort"));
      return;
    }
    if (trimmed.length > 120) {
      setError(td("manualProductNameTooLong"));
      return;
    }
    onConfirm(trimmed);
    reset();
  };

  return (
    <AppModalOverlay open={open} onBackdropClick={handleClose} aria-labelledby="manual-product-title">
      <div
        className={cn("w-full max-w-md rounded-2xl border bg-card p-4 shadow-2xl", t.modalShell)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <PackagePlus className="mt-0.5 size-5 shrink-0 text-sky-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="manual-product-title" className="text-base font-bold text-foreground">
              {td("manualProductModalTitle")}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{td("manualProductModalHint")}</p>
          </div>
        </div>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-xs font-semibold text-foreground">
            {td("manualProductNameLabel")}
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              className={cn(
                "mt-1.5 h-11 w-full rounded-xl border-2 bg-background px-3 text-sm",
                t.searchInput,
                t.focus
              )}
              autoFocus
              maxLength={120}
            />
          </label>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold"
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              className={cn(
                "inline-flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-white",
                t.cta
              )}
            >
              {td("manualProductAddToList")}
            </button>
          </div>
        </form>
      </div>
    </AppModalOverlay>
  );
}

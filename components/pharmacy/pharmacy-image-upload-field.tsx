"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import type { PharmacyImageKind } from "@/lib/storage-media";
import { removePharmacyImageFile, uploadPharmacyImageFile } from "@/lib/pharmacy-media";

type Props = {
  pharmacyId: string;
  kind: PharmacyImageKind;
  label: string;
  hint: string;
  storedPath: string;
  onStoredPathChange: (path: string) => void;
  aspectClass?: string;
};

export function PharmacyImageUploadField({
  pharmacyId,
  kind,
  label,
  hint,
  storedPath,
  onStoredPathChange,
  aspectClass = "aspect-[21/9]",
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState(0);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const storedPreviewUrl = resolvePublicMediaUrl(storedPath.trim() || null);
  const previewUrl =
    localPreviewUrl ??
    (storedPreviewUrl
      ? `${storedPreviewUrl}${storedPreviewUrl.includes("?") ? "&" : "?"}v=${previewToken}`
      : null);

  const pickFile = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLocalError("");
    const blobPreview = URL.createObjectURL(file);
    setLocalPreviewUrl(blobPreview);
    setBusy(true);
    const previousPath = storedPath.trim() || null;
    const { path, error } = await uploadPharmacyImageFile(pharmacyId, kind, file, previousPath);
    setBusy(false);
    URL.revokeObjectURL(blobPreview);
    setLocalPreviewUrl(null);
    if (error) {
      setLocalError(error);
      return;
    }
    setPreviewToken(Date.now());
    onStoredPathChange(path);
  };

  const remove = async () => {
    setLocalError("");
    const prev = storedPath.trim();
    onStoredPathChange("");
    if (!prev) return;
    setBusy(true);
    const err = await removePharmacyImageFile(prev);
    setBusy(false);
    if (err) setLocalError(err);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
      <div
        className={clsx(
          "relative overflow-hidden rounded-xl border border-border bg-muted/25",
          aspectClass,
          kind === "logo" && "mx-auto max-w-[140px]"
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full min-h-[5rem] flex-col items-center justify-center gap-1 p-3 text-center text-[10px] text-muted-foreground">
            <ImagePlus className="size-6 opacity-50" aria-hidden />
            Aucune image
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-[11px] font-semibold text-white">
            Envoi…
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => pickFile()}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-muted/40 disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" aria-hidden />
          {previewUrl ? "Remplacer" : "Choisir une photo"}
        </button>
        {previewUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-950 hover:bg-rose-100 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Retirer
          </button>
        ) : null}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void onFile(f);
        }}
      />
      {localError ? <p className="text-[11px] text-rose-800">{localError}</p> : null}
    </div>
  );
}

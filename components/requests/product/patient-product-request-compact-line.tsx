"use client";

import { MessageSquare, Minus, Package, Plus, Trash2 } from "lucide-react";
import { PatientLineCommentModal } from "@/components/pharmacy/patient-demande-produits-ui";
import { formatPriceDh } from "@/lib/product-price";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";
import { useState } from "react";

const THUMB = "size-14 shrink-0";

export type PatientDossierCompactLine = {
  product_id: string;
  name: string;
  photo_url?: string | null;
  qty: number;
  client_comment?: string;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
};

export function PatientProductRequestCompactLine({
  line,
  unitPrice,
  editMode,
  onRemove,
  onPhotoPreview,
  onSetQty,
  onSaveComment,
  notesSlot,
}: {
  line: PatientDossierCompactLine;
  unitPrice: number | null;
  editMode: boolean;
  onRemove?: () => void;
  onPhotoPreview: () => void;
  onSetQty: (qty: number) => void;
  onSaveComment?: (comment: string) => void;
  /** Bandeau notes existant (lecture) si pas en édition commentaire inline */
  notesSlot?: React.ReactNode;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState(line.client_comment ?? "");
  const hasComment = Boolean(line.client_comment?.trim());

  return (
    <>
      <li className="flex items-center gap-2 border-b border-border/50 py-2 last:border-b-0">
        <div className={cn("relative overflow-hidden rounded-lg border border-border/80 bg-card", THUMB)}>
          {editMode && onRemove ? (
            <button
              type="button"
              aria-label="Retirer"
              className="absolute right-0.5 top-0.5 z-10 rounded-md bg-background/95 p-0.5 text-destructive shadow-sm hover:bg-destructive/10"
              onClick={onRemove}
            >
              <Trash2 size={13} />
            </button>
          ) : null}
          {line.photo_url ? (
            <button
              type="button"
              className={cn("size-full cursor-zoom-in focus:outline-none focus-visible:ring-2", t.photoRing)}
              aria-label={`Agrandir la photo · ${line.name}`}
              onClick={onPhotoPreview}
            >
              <img src={line.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
            </button>
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Package className="size-5 text-muted-foreground" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-between gap-0.5 py-0.5">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground" title={line.name}>
            {line.name}
          </p>
          {line.line_source === "pharmacist_proposed" ? (
            <p className="truncate text-[9px] font-medium text-violet-900" title={line.pharmacist_proposal_reason ?? undefined}>
              Proposé officine
              {line.pharmacist_proposal_reason ? ` — ${line.pharmacist_proposal_reason}` : ""}
            </p>
          ) : null}
          <div className="flex flex-nowrap items-baseline justify-between gap-2 text-[11px]">
            <span className="inline-flex min-w-0 items-baseline gap-0.5 text-muted-foreground">
              <span className="shrink-0 font-semibold">PU</span>
              <strong className="font-semibold text-foreground">{formatPriceDh(unitPrice)}</strong>
            </span>
            <span className={cn("inline-flex shrink-0 items-baseline gap-0.5 font-bold", t.price)}>
              <span className="font-semibold text-sky-600/80">Tot</span>
              {unitPrice != null ? formatPriceDh(unitPrice * line.qty) : "—"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Qté</span>
            <button
              type="button"
              aria-label="Diminuer"
              disabled={!editMode || line.qty <= 1}
              className="rounded-md border border-border/80 bg-card p-0.5 shadow-sm hover:bg-muted/40 disabled:opacity-40"
              onClick={() => onSetQty(line.qty - 1)}
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-xs font-semibold tabular-nums">{line.qty}</span>
            <button
              type="button"
              aria-label="Augmenter"
              disabled={!editMode || line.qty >= 10}
              className="rounded-md border border-border/80 bg-card p-0.5 shadow-sm hover:bg-muted/40 disabled:opacity-40"
              onClick={() => onSetQty(line.qty + 1)}
            >
              <Plus size={14} />
            </button>
            {editMode && onSaveComment ? (
              <button
                type="button"
                onClick={() => {
                  setCommentDraft(line.client_comment ?? "");
                  setCommentOpen(true);
                }}
                className={cn(
                  "ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition",
                  hasComment ? t.noteActive : cn("border-border/80 bg-card text-muted-foreground", t.noteIdle)
                )}
              >
                <MessageSquare className="size-3 shrink-0" aria-hidden />
                {hasComment ? "Note" : "Message"}
              </button>
            ) : (
              notesSlot
            )}
          </div>
        </div>
      </li>
      {editMode && onSaveComment ? (
        <PatientLineCommentModal
          open={commentOpen}
          productName={line.name}
          value={commentDraft}
          onChange={setCommentDraft}
          onClose={() => setCommentOpen(false)}
          onSave={() => {
            onSaveComment(commentDraft.trim().slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX));
            setCommentOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

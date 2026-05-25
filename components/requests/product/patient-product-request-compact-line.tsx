"use client";

import { MessageSquare, Minus, Package, Plus, Trash2 } from "lucide-react";
import { PatientLineCommentModal, ProductRequestLineBodyGrid } from "@/components/pharmacy/patient-demande-produits-ui";
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
      <li className="border-b border-border/50 py-2 last:border-b-0">
        <div
          className={cn(
            "grid min-h-14 min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5",
            line.line_source === "pharmacist_proposed" ? "grid-rows-[auto_1fr]" : "grid-rows-[auto_1fr] h-14"
          )}
        >
          <div
            className={cn(
              "row-span-2 shrink-0 self-stretch overflow-hidden rounded-lg border border-border/80 bg-card",
              THUMB,
              line.line_source === "pharmacist_proposed" ? "h-14 w-14" : "size-14"
            )}
          >
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
          <div className="col-start-2 row-start-1 flex min-w-0 items-start gap-1.5 leading-none">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-foreground" title={line.name}>
                {line.name}
              </p>
              {line.line_source === "pharmacist_proposed" ? (
                <p
                  className="truncate text-[9px] font-medium text-violet-900"
                  title={line.pharmacist_proposal_reason ?? undefined}
                >
                  Proposé officine
                  {line.pharmacist_proposal_reason ? ` — ${line.pharmacist_proposal_reason}` : ""}
                </p>
              ) : null}
            </div>
            {editMode && onRemove ? (
              <button
                type="button"
                aria-label="Retirer"
                className="shrink-0 rounded p-0.5 text-destructive transition hover:bg-destructive/10"
                onClick={onRemove}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
          <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 items-start overflow-hidden pt-px">
            <ProductRequestLineBodyGrid
              className="!h-auto min-h-0 w-full"
              unitPrice={unitPrice}
              qty={line.qty}
              totalValue={unitPrice != null ? unitPrice * line.qty : null}
              onDecQty={() => onSetQty(line.qty - 1)}
              onIncQty={() => onSetQty(line.qty + 1)}
              qtyDisabledDec={!editMode || line.qty <= 1}
              qtyDisabledInc={!editMode || line.qty >= 10}
              messageButton={
                editMode && onSaveComment ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCommentDraft(line.client_comment ?? "");
                      setCommentOpen(true);
                    }}
                    className={cn(
                      "inline-flex max-w-[4.25rem] items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold leading-none whitespace-nowrap transition",
                      hasComment ? t.noteActive : cn("border-border/80 bg-card text-muted-foreground", t.noteIdle)
                    )}
                  >
                    <MessageSquare className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{hasComment ? "Note" : "Message"}</span>
                  </button>
                ) : (
                  notesSlot
                )
              }
            />
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

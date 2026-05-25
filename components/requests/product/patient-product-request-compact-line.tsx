"use client";

import { Package, Trash2 } from "lucide-react";
import {
  PatientLineCommentModal,
  PRODUCT_REQUEST_LINE_BLOCK_H,
  PRODUCT_REQUEST_LINE_THUMB,
  ProductRequestLineBodyGrid,
  ProductRequestLineMessageButton,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { formatPriceDh } from "@/lib/product-price";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";
import { useState } from "react";

const THUMB = PRODUCT_REQUEST_LINE_THUMB;

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
      <li className="border-b border-border/50 py-2.5 last:border-b-0">
        <div
          className={cn(
            "flex min-w-0 items-stretch gap-x-2.5",
            line.line_source === "pharmacist_proposed" ? "h-24" : PRODUCT_REQUEST_LINE_BLOCK_H
          )}
        >
          <div
            className={cn(
              "shrink-0 overflow-hidden rounded-lg border border-border/80 bg-card",
              line.line_source === "pharmacist_proposed" ? "size-24" : THUMB
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
          <div
            className={cn(
              "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-1.5",
              line.line_source === "pharmacist_proposed"
                ? "h-24 grid-rows-[1.75rem_minmax(0,1fr)_1.375rem]"
                : cn(PRODUCT_REQUEST_LINE_BLOCK_H, "grid-rows-[1.25rem_minmax(0,1fr)_1.375rem]")
            )}
          >
            <div
              className={cn(
                "col-start-1 row-start-1 min-w-0 leading-none",
                line.line_source === "pharmacist_proposed" ? "space-y-0" : "flex items-center"
              )}
            >
              <p className="truncate text-xs font-semibold leading-tight text-foreground" title={line.name}>
                {line.name}
              </p>
              {line.line_source === "pharmacist_proposed" ? (
                <p
                  className="truncate text-[9px] font-medium leading-none text-violet-900"
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
                className="col-start-2 row-start-1 justify-self-end rounded p-0.5 text-destructive transition hover:bg-destructive/10"
                onClick={onRemove}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
            <div className="col-start-1 row-start-2 min-h-0 min-w-0 self-center overflow-hidden">
              <ProductRequestLineBodyGrid
                className="h-full w-full"
                unitPrice={unitPrice}
                qty={line.qty}
                totalValue={unitPrice != null ? unitPrice * line.qty : null}
                onDecQty={() => onSetQty(line.qty - 1)}
                onIncQty={() => onSetQty(line.qty + 1)}
                qtyDisabledDec={!editMode || line.qty <= 1}
                qtyDisabledInc={!editMode || line.qty >= 10}
              />
            </div>
            <div className="col-start-2 row-start-3 flex items-end justify-end">
              {editMode && onSaveComment ? (
                <ProductRequestLineMessageButton
                  hasComment={hasComment}
                  className="px-2 py-1 text-[10px]"
                  onClick={() => {
                    setCommentDraft(line.client_comment ?? "");
                    setCommentOpen(true);
                  }}
                />
              ) : (
                notesSlot
              )}
            </div>
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

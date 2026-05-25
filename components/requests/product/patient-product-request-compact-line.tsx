"use client";

import { Package, Trash2 } from "lucide-react";
import {
  PatientLineCommentModal,
  PRODUCT_REQUEST_LINE_BLOCK_H,
  PRODUCT_REQUEST_LINE_THUMB,
  ProductRequestLineMessageButton,
  ProductRequestLinePanel,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";
import { useState } from "react";

const PROPOSED_BLOCK_H = "h-[4.75rem]";

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
  notesSlot?: React.ReactNode;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState(line.client_comment ?? "");
  const hasComment = Boolean(line.client_comment?.trim());
  const isProposed = line.line_source === "pharmacist_proposed";
  const blockClassName = isProposed ? PROPOSED_BLOCK_H : PRODUCT_REQUEST_LINE_BLOCK_H;

  const thumbInner = line.photo_url ? (
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
  );

  return (
    <>
      <li className="border-b border-border/50 py-2.5 last:border-b-0">
        <ProductRequestLinePanel
          blockClassName={blockClassName}
          title={
            <div className="min-w-0 leading-none">
              <p className="truncate text-xs font-semibold text-foreground" title={line.name}>
                {line.name}
              </p>
              {isProposed ? (
                <p
                  className="truncate text-[9px] font-medium text-violet-900"
                  title={line.pharmacist_proposal_reason ?? undefined}
                >
                  Proposé officine
                  {line.pharmacist_proposal_reason ? ` — ${line.pharmacist_proposal_reason}` : ""}
                </p>
              ) : null}
            </div>
          }
          topRight={
            editMode && onRemove ? (
              <button
                type="button"
                aria-label="Retirer"
                className="rounded p-0.5 text-destructive transition hover:bg-destructive/10"
                onClick={onRemove}
              >
                <Trash2 size={14} />
              </button>
            ) : undefined
          }
          unitPrice={unitPrice}
          totalValue={unitPrice != null ? unitPrice * line.qty : null}
          qty={line.qty}
          onDecQty={() => onSetQty(line.qty - 1)}
          onIncQty={() => onSetQty(line.qty + 1)}
          qtyDisabledDec={!editMode || line.qty <= 1}
          qtyDisabledInc={!editMode || line.qty >= 10}
          bottomRight={
            editMode && onSaveComment ? (
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
            )
          }
          thumb={thumbInner}
          thumbClassName={isProposed ? "!size-[4.75rem]" : undefined}
        />
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

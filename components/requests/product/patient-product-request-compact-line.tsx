"use client";

import { Package } from "lucide-react";
import {
  PatientLineCommentModal,
  PRODUCT_REQUEST_LINE_CARD_SHELL,
  ProductRequestLineDeleteButton,
  ProductRequestLineMessageIconButton,
  ProductRequestLinePanel,
  ProductRequestLineQtyPicker,
  ProductRequestLineQtyReadonly,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
      <li className={cn("relative w-full min-w-0 overflow-visible p-1", PRODUCT_REQUEST_LINE_CARD_SHELL)}>
        {editMode && onRemove ? <ProductRequestLineDeleteButton onClick={onRemove} /> : null}
        <ProductRequestLinePanel
          contentMinHeight={isProposed ? "min-h-16" : undefined}
          title={
            <div className="min-w-0">
              <p className="truncate pb-px text-[13px] font-semibold leading-snug text-foreground" title={line.name}>
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
          unitPrice={unitPrice}
          totalValue={unitPrice != null ? unitPrice * line.qty : null}
          qtyControl={
            editMode ? (
              <ProductRequestLineQtyPicker
                qty={line.qty}
                onSelect={(n) => onSetQty(Math.min(10, Math.max(1, n)))}
              />
            ) : (
              <ProductRequestLineQtyReadonly qty={line.qty} />
            )
          }
          bottomRight={
            editMode && onSaveComment ? (
              <ProductRequestLineMessageIconButton
                hasComment={hasComment}
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

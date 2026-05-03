"use client";

import { useMemo, useState } from "react";
import { CompactCard, CompactCardBody, CompactCardHeader } from "@/components/ui/compact-shell";
import {
  PATIENT_CANCEL_REASON_CODES,
  PATIENT_CANCEL_REASON_LABELS,
  type PatientCancelReasonCode,
} from "@/lib/patient-flow-reasons";
import { supabase } from "@/lib/supabase";

type Props = {
  requestId: string;
  onDone: () => Promise<void>;
};

export function PatientCancelBeforeResponse({ requestId, onDone }: Props) {
  const [code, setCode] = useState<PatientCancelReasonCode>("no_longer_needed");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  const showDetail = code === "other";

  const canSubmitOther = useMemo(() => trimDetail(detail).length >= 8, [detail]);

  return (
    <CompactCard className="mt-3 border-destructive/25 bg-destructive/[0.04]">
      <CompactCardHeader title="Annuler la demande" />
      <CompactCardBody>
      <p className="text-[11px] text-muted-foreground">Avant réponse du pharmacien : annulation définitive avec motif.</p>
      {localErr ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{localErr}</p>
      ) : null}

      <label className="mt-2 block text-[11px] font-medium text-foreground">
        Motif
        <select
          value={code}
          onChange={(e) => setCode(e.target.value as PatientCancelReasonCode)}
          className="mt-0.5 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        >
          {PATIENT_CANCEL_REASON_CODES.map((c) => (
            <option key={c} value={c}>
              {PATIENT_CANCEL_REASON_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {showDetail ? (
        <label className="mt-2 block text-[11px] font-medium text-foreground">
          Précise (min. 8 caractères)
          <textarea
            value={detail}
            rows={2}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Explique brièvement la raison..."
            className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          />
        </label>
      ) : null}

      <button
        type="button"
        disabled={busy || (showDetail && !canSubmitOther)}
        onClick={() => void run()}
        className="mt-3 w-full rounded-md border border-destructive/40 bg-background py-2 text-xs font-semibold text-destructive disabled:opacity-50"
      >
        {busy ? "Annulation…" : "Annuler définitivement"}
      </button>
    </CompactCardBody>
    </CompactCard>
  );

  async function run() {
    const d = trimDetail(detail);
    if (code === "other" && d.length < 8) {
      setLocalErr("Merci de détailler au moins 8 caractères pour « Autre ».");
      return;
    }

    const okMsg =
      code === "other"
        ? "Confirmer l’annulation avec ce motif ?"
        : "Annuler définitivement cette demande auprès de la pharmacie\u202f?";

    if (!globalThis.confirm(okMsg)) {
      return;
    }

    setLocalErr("");
    setBusy(true);

    const { error } = await supabase.rpc("patient_cancel_product_request_before_response", {
      p_request_id: requestId,
      p_reason_code: code,
      p_reason_other: code === "other" ? d : null,
    });
    setBusy(false);

    if (error) {
      setLocalErr(error.message);
      return;
    }

    await onDone();
  }
}

function trimDetail(s: string): string {
  return s.trim();
}

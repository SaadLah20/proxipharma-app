"use client";

import { useMemo, useState } from "react";
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
    <section className="mt-6 rounded-xl border border-rose-100 bg-rose-50/30 p-4">
      <h2 className="text-sm font-semibold text-rose-950">Annuler la demande</h2>
      <p className="mt-1 text-xs text-rose-900/90">
        Tant que le pharmacien n’a pas répondu, tu peux annuler définitivement cette demande. Indique un motif.
      </p>

      {localErr ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{localErr}</p>
      ) : null}

      <label className="mt-4 block text-xs font-medium text-gray-700">
        Motif
        <select
          value={code}
          onChange={(e) => setCode(e.target.value as PatientCancelReasonCode)}
          className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          {PATIENT_CANCEL_REASON_CODES.map((c) => (
            <option key={c} value={c}>
              {PATIENT_CANCEL_REASON_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {showDetail ? (
        <label className="mt-3 block text-xs font-medium text-gray-700">
          Précise (min. 8 caractères)
          <textarea
            value={detail}
            rows={3}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Explique brièvement la raison..."
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      ) : null}

      <button
        type="button"
        disabled={busy || (showDetail && !canSubmitOther)}
        onClick={() => void run()}
        className="mt-4 w-full rounded-lg border border-red-300 bg-white py-2.5 text-sm font-semibold text-red-900 disabled:opacity-50"
      >
        {busy ? "Annulation…" : "Annuler définitivement"}
      </button>
    </section>
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

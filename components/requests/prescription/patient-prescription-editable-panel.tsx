"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, FileImage, Trash2 } from "lucide-react";
import { requestStatusFr } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";
import { RequestExitConfirmModalFr } from "@/components/requests/request-exit-confirm-modal-fr";
import type { PatientCancelReasonCode } from "@/lib/patient-flow-reasons";
import {
  compressImageFileForPrescription,
  createPrescriptionSignedUrl,
  type PrescriptionPagePaths,
  uploadPrescriptionPageBlob,
} from "@/lib/prescription-media";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";

type PageSlot = { page: 1 | 2; previewUrl: string; path: string; isNew?: boolean };

const MAX_PAGES = 2;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type PatientPrescriptionPanelHandle = {
  startEdit: () => void;
  cancelEdit: () => void;
  save: () => Promise<void>;
  openCancelOrdonnance: () => void;
  isBusy: () => boolean;
  canSave: () => boolean;
};

type Props = {
  requestId: string;
  status: string;
  paths: PrescriptionPagePaths;
  patientNote: string | null;
  onReload: () => Promise<void>;
  editMode: boolean;
  onEditModeChange: (next: boolean) => void;
};

export const PatientPrescriptionEditablePanel = forwardRef<PatientPrescriptionPanelHandle, Props>(
  function PatientPrescriptionEditablePanel(
    { requestId, status, paths, patientNote, onReload, editMode, onEditModeChange },
    ref
  ) {
    const [localNote, setLocalNote] = useState<string | null>(null);
    const [prevNote, setPrevNote] = useState(patientNote ?? "");
    if ((patientNote ?? "") !== prevNote) {
      setPrevNote(patientNote ?? "");
      setLocalNote(null);
    }
    const displayNote = localNote ?? patientNote ?? "";
    const [noteDraft, setNoteDraft] = useState(displayNote);
    const [pages, setPages] = useState<PageSlot[]>([]);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [exitOpen, setExitOpen] = useState(false);
    const [dirty, setDirty] = useState(false);
    const snapshotRef = useRef<{ pages: PageSlot[]; note: string } | null>(null);
    const cameraRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const editable = status === "submitted" || status === "in_review";
    const canEditContent = editable && editMode;

    useEffect(() => {
      setNoteDraft(displayNote);
    }, [displayNote]);

    useEffect(() => {
      let cancelled = false;
      void (async () => {
        const next: PageSlot[] = [];
        if (paths.page1) {
          const { url } = await createPrescriptionSignedUrl(paths.page1);
          if (url) next.push({ page: 1, previewUrl: url, path: paths.page1 });
        }
        if (paths.page2) {
          const { url } = await createPrescriptionSignedUrl(paths.page2);
          if (url) next.push({ page: 2, previewUrl: url, path: paths.page2 });
        }
        if (!cancelled) setPages(next);
      })();
      return () => {
        cancelled = true;
      };
    }, [paths.page1, paths.page2]);

    const revokePreviews = useCallback((slots: PageSlot[]) => {
      for (const s of slots) if (s.isNew) URL.revokeObjectURL(s.previewUrl);
    }, []);

    useEffect(() => () => revokePreviews(pages), [pages, revokePreviews]);

    const persistPages = async (slots: PageSlot[]) => {
      const p1 = slots.find((s) => s.page === 1);
      if (!p1) throw new Error("La page 1 est obligatoire.");
      const p2 = slots.find((s) => s.page === 2);
      const { error } = await supabase.rpc("patient_attach_prescription_pages", {
        p_request_id: requestId,
        p_page1_path: p1.path,
        p_page2_path: p2?.path ?? null,
      });
      if (error) throw new Error(error.message);
    };

    const reloadPagesFromPaths = useCallback(async () => {
      const next: PageSlot[] = [];
      if (paths.page1) {
        const { url } = await createPrescriptionSignedUrl(paths.page1);
        if (url) next.push({ page: 1, previewUrl: url, path: paths.page1 });
      }
      if (paths.page2) {
        const { url } = await createPrescriptionSignedUrl(paths.page2);
        if (url) next.push({ page: 2, previewUrl: url, path: paths.page2 });
      }
      setPages(next);
    }, [paths.page1, paths.page2]);

    const addFiles = async (files: FileList | File[]) => {
      setFeedback("");
      const list = Array.from(files);
      if (list.length === 0) return;
      const file = list[0]!;
      if (file.size > MAX_FILE_BYTES) {
        setFeedback("Fichier trop volumineux (max 8 Mo).");
        return;
      }
      const targetPage: 1 | 2 =
        pages.length === 0 || !pages.some((p) => p.page === 1) ? 1 : 2;
      if (targetPage === 2 && pages.some((p) => p.page === 2)) {
        setFeedback("Maximum 2 pages.");
        return;
      }
      setBusy(true);
      try {
        const blob = await compressImageFileForPrescription(file);
        const { path, error: upErr } = await uploadPrescriptionPageBlob(requestId, targetPage, blob);
        if (upErr) {
          setFeedback(upErr);
          return;
        }
        const previewUrl = URL.createObjectURL(blob);
        setPages((prev) => {
          revokePreviews(prev.filter((p) => p.page === targetPage));
          const rest = prev.filter((p) => p.page !== targetPage);
          return [...rest, { page: targetPage, previewUrl, path, isNew: true }].sort((a, b) => a.page - b.page);
        });
        setDirty(true);
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : "Erreur lors de l'ajout.");
      } finally {
        setBusy(false);
      }
    };

    const removePage = (page: 1 | 2) => {
      if (page === 1 && pages.some((p) => p.page === 2)) {
        setFeedback("Retirez d'abord la page 2.");
        return;
      }
      setPages((prev) => {
        const slot = prev.find((p) => p.page === page);
        if (slot?.isNew) URL.revokeObjectURL(slot.previewUrl);
        return prev.filter((p) => p.page !== page);
      });
      setDirty(true);
    };

    const saveAll = async () => {
      setFeedback("");
      if (!pages.some((p) => p.page === 1)) {
        setFeedback("Au moins la page 1 de l'ordonnance est requise.");
        return;
      }
      setBusy(true);
      try {
        await persistPages(pages);
        const { error: noteErr } = await supabase.rpc("patient_update_prescription_note", {
          p_request_id: requestId,
          p_patient_note: noteDraft.trim() || null,
        });
        if (noteErr) throw new Error(noteErr.message);
        setLocalNote(noteDraft.trim());
        setDirty(false);
        snapshotRef.current = null;
        onEditModeChange(false);
        await onReload();
      } catch (e) {
        setFeedback(e instanceof Error ? e.message : "Enregistrement impossible.");
      } finally {
        setBusy(false);
      }
    };

    const cancelEdit = () => {
      setFeedback("");
      const snap = snapshotRef.current;
      if (snap) {
        revokePreviews(pages.filter((p) => p.isNew && !snap.pages.some((s) => s.path === p.path)));
        setPages(snap.pages);
        setNoteDraft(snap.note);
      } else {
        void reloadPagesFromPaths();
        setNoteDraft(displayNote);
      }
      setDirty(false);
      snapshotRef.current = null;
      onEditModeChange(false);
    };

    const startEdit = () => {
      snapshotRef.current = {
        pages: pages.map((p) => ({ ...p })),
        note: noteDraft,
      };
      onEditModeChange(true);
    };

    const handleCancelOrdonnance = async (p: {
      kind: "patient";
      code: PatientCancelReasonCode;
      other: string | null;
    }) => {
      setBusy(true);
      const { error: rpcErr } = await supabase.rpc("patient_cancel_product_request_before_response", {
        p_request_id: requestId,
        p_reason_code: p.code,
        p_reason_other: p.other,
      });
      setBusy(false);
      if (rpcErr) {
        setFeedback(rpcErr.message);
        return;
      }
      setExitOpen(false);
      onEditModeChange(false);
      await onReload();
    };

    useImperativeHandle(
      ref,
      () => ({
        startEdit,
        cancelEdit,
        save: saveAll,
        openCancelOrdonnance: () => setExitOpen(true),
        isBusy: () => busy,
        canSave: () => dirty,
      }),
      [busy, dirty, pages, noteDraft]
    );

    const viewerPaths: PrescriptionPagePaths = {
      page1: pages.find((p) => p.page === 1)?.path ?? paths.page1,
      page2: pages.find((p) => p.page === 2)?.path ?? paths.page2,
    };

    return (
      <section className="mt-2 space-y-3">
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-sm text-amber-950">
          <p className="font-semibold">{requestStatusFr[status] ?? status}</p>
          <p className="mt-1 text-xs leading-snug text-amber-900/90">
            {editMode
              ? "Modifiez le scan ou votre message, puis enregistrez."
              : "Lecture seule tant que vous n'avez pas appuyé sur Modifier."}
          </p>
        </div>

        <PrescriptionImageViewer paths={viewerPaths} accent="amber" />

        {canEditContent ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || pages.length >= MAX_PAGES}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-50 disabled:opacity-50"
            >
              <Camera className="size-4" aria-hidden />
              Photo
            </button>
            <button
              type="button"
              disabled={busy || pages.length >= MAX_PAGES}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-50 disabled:opacity-50"
            >
              <FileImage className="size-4" aria-hidden />
              Fichier
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files;
                if (f?.length) void addFiles(f);
                e.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files;
                if (f?.length) void addFiles(f);
                e.target.value = "";
              }}
            />
          </div>
        ) : null}

        {pages.length > 0 && canEditContent ? (
          <ul className="flex flex-wrap gap-2">
            {pages.map((p) => (
              <li key={p.page} className="relative">
                <img src={p.previewUrl} alt={`Page ${p.page}`} className="h-20 w-16 rounded-lg border object-cover" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removePage(p.page)}
                  className="absolute -right-1 -top-1 rounded-full bg-rose-600 p-0.5 text-white shadow"
                  aria-label={`Retirer page ${p.page}`}
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-xl border border-border/80 bg-card px-3 py-2.5 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Votre message</p>
          {canEditContent ? (
            <textarea
              rows={3}
              maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
              value={noteDraft}
              onChange={(e) => {
                setNoteDraft(e.target.value);
                setDirty(true);
              }}
              className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-foreground">{displayNote.trim() || "—"}</p>
          )}
        </div>

        {feedback ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {feedback}
          </p>
        ) : null}

        <RequestExitConfirmModalFr
          open={exitOpen}
          mode="patient_before_response"
          busy={busy}
          onClose={() => setExitOpen(false)}
          onConfirmPatient={(p) => void handleCancelOrdonnance(p)}
        />
      </section>
    );
  }
);

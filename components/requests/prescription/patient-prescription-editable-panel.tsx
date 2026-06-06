"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera, FileImage, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { RequestExitConfirmModalFr } from "@/components/requests/request-exit-confirm-modal-fr";
import type { PatientCancelReasonCode } from "@/lib/patient-flow-reasons";
import {
  compressImageFileForPrescription,
  createPrescriptionSignedUrl,
  type PrescriptionPagePaths,
  uploadPrescriptionPageBlob,
} from "@/lib/prescription-media";
import { preparePatientRequestPhoto } from "@/lib/patient-request-photo-upload";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";

type PageSlot = { page: 1 | 2; previewUrl: string; path: string; isNew?: boolean };

const MAX_PAGES = 2;

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
  /** État pour le footer parent (évite lecture de ref pendant le render). */
  onFooterStateChange?: (state: { busy: boolean; canSave: boolean }) => void;
};

export const PatientPrescriptionEditablePanel = forwardRef<PatientPrescriptionPanelHandle, Props>(
  function PatientPrescriptionEditablePanel(
    { requestId, status, paths, patientNote, onReload, editMode, onEditModeChange, onFooterStateChange },
    ref
  ) {
    const tPanel = useTranslations("prescription.panel");
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
      if (!p1) throw new Error(tPanel("page1Required"));
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
      const targetPage: 1 | 2 =
        pages.length === 0 || !pages.some((p) => p.page === 1) ? 1 : 2;
      if (targetPage === 2 && pages.some((p) => p.page === 2)) {
        setFeedback(tPanel("maxPages"));
        return;
      }
      setBusy(true);
      try {
        const prepared = await preparePatientRequestPhoto(file, compressImageFileForPrescription);
        if (!prepared.ok) {
          setFeedback(prepared.error);
          return;
        }
        const blob = prepared.blob;
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
        setFeedback(e instanceof Error ? e.message : tPanel("addError"));
      } finally {
        setBusy(false);
      }
    };

    const removePage = (page: 1 | 2) => {
      if (page === 1 && pages.some((p) => p.page === 2)) {
        setFeedback(tPanel("removePage2First"));
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
        setFeedback(tPanel("atLeastPage1"));
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
        setFeedback(e instanceof Error ? e.message : tPanel("saveFailed"));
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

    useEffect(() => {
      onFooterStateChange?.({ busy, canSave: dirty });
    }, [busy, dirty, onFooterStateChange]);

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

    const viewerPaths: PrescriptionPagePaths = editMode
      ? {
          page1: pages.find((p) => p.page === 1)?.path ?? null,
          page2: pages.find((p) => p.page === 2)?.path ?? null,
        }
      : paths;

    return (
      <section className="mt-2 space-y-3">
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

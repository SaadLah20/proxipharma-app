"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, FileImage, FileText, Trash2, X } from "lucide-react";
import { PharmacyFlowHero, PharmacyPublicBackLink, pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import { platformDashboardChrome } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { PlatformStickyFooter } from "@/components/layout/platform-sticky-footer";
import { stickyFooterPadClass } from "@/lib/platform-sticky-footer";
import { cn } from "@/lib/utils";
import {
  compressImageFileForPrescription,
  uploadPrescriptionPageBlob,
} from "@/lib/prescription-media";
import { preparePatientRequestPhoto } from "@/lib/patient-request-photo-upload";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { sendRequestConversationMessage } from "@/lib/send-request-conversation-message";
import {
  ConversationAudioDraftPreview,
  ConversationMessageDraftField,
} from "@/components/requests/conversation/conversation-message-draft-field";
import type { ConversationAudioDraft } from "@/lib/use-conversation-audio-recorder";

type PageSlot = {
  file: File;
  previewUrl: string;
};

const MAX_PAGES = 2;

export default function DemandeOrdonnancePage() {
  const tp = useTranslations("prescriptionPublic");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const pharmacyId = typeof params.id === "string" ? params.id : "";

  const [pharmacyName, setPharmacyName] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [pages, setPages] = useState<PageSlot[]>([]);
  const [note, setNote] = useState("");
  const [pendingAudio, setPendingAudio] = useState<ConversationAudioDraft | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const gate = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace(`/auth?redirect=/pharmacie/${pharmacyId}/demande-ordonnance`);
        return;
      }
      setSessionReady(true);
    };
    void gate();
  }, [router, pharmacyId]);

  useEffect(() => {
    if (!pharmacyId || !sessionReady) return;
    void supabase
      .from("pharmacies")
      .select("nom")
      .eq("id", pharmacyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nom) setPharmacyName(data.nom);
      });
  }, [pharmacyId, sessionReady]);

  const revokePreviews = useCallback((slots: PageSlot[]) => {
    for (const s of slots) URL.revokeObjectURL(s.previewUrl);
  }, []);

  useEffect(() => () => revokePreviews(pages), [pages, revokePreviews]);

  const addFiles = async (files: FileList | File[]) => {
    setFeedback(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    const remaining = MAX_PAGES - pages.length;
    if (remaining <= 0) {
      setFeedback({ type: "err", text: tp("maxPagesError") });
      return;
    }
    const toAdd = list.slice(0, remaining);
    const next: PageSlot[] = [];
    for (const f of toAdd) {
      const prepared = await preparePatientRequestPhoto(f, compressImageFileForPrescription);
      if (!prepared.ok) {
        setFeedback({ type: "err", text: prepared.error });
        return;
      }
      const previewFile = new File([prepared.blob], f.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
      next.push({ file: previewFile, previewUrl: URL.createObjectURL(previewFile) });
    }
    setPages((prev) => [...prev, ...next]);
  };

  const removePage = (index: number) => {
    setPages((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  };

  const validate = () => {
    if (pages.length < 1) return tp("addAtLeastOnePhoto");
    return null;
  };

  const submit = async () => {
    setFeedback(null);
    const v = validate();
    if (v) {
      setFeedback({ type: "err", text: v });
      return;
    }
    setConfirmOpen(false);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setFeedback({ type: "err", text: tp("sessionExpired") });
      return;
    }

    setSubmitLoading(true);

    const noteTrim = note.trim().slice(0, REQUEST_CONVERSATION_MESSAGE_MAX);
    const hasAudio = pendingAudio != null;
    const hasText = noteTrim.length > 0;

    const { data: requestIdRaw, error: rpcErr } = await supabase.rpc("patient_submit_prescription_request", {
      p_pharmacy_id: pharmacyId,
      p_patient_note: hasAudio ? null : noteTrim.length > 0 ? noteTrim : null,
    });

    if (rpcErr) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: rpcErr.message });
      return;
    }

    const requestId =
      typeof requestIdRaw === "string"
        ? requestIdRaw
        : Array.isArray(requestIdRaw)
          ? (requestIdRaw[0] as string | undefined)
          : null;

    if (!requestId) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: tp("unexpectedResponse") });
      return;
    }

    const up1 = await uploadPrescriptionPageBlob(requestId, 1, pages[0].file);
    if (up1.error) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: up1.error });
      return;
    }

    let page2Path: string | null = null;
    if (pages[1]) {
      const up2 = await uploadPrescriptionPageBlob(requestId, 2, pages[1].file);
      if (up2.error) {
        setSubmitLoading(false);
        setFeedback({ type: "err", text: up2.error });
        return;
      }
      page2Path = up2.path;
    }

    const { error: attachErr } = await supabase.rpc("patient_attach_prescription_pages", {
      p_request_id: requestId,
      p_page1_path: up1.path,
      p_page2_path: page2Path,
    });

    if (attachErr) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: attachErr.message });
      return;
    }

    if (hasAudio) {
      if (hasText) {
        const { error: noteErr } = await supabase.rpc("patient_update_prescription_note", {
          p_request_id: requestId,
          p_patient_note: noteTrim,
        });
        if (noteErr) {
          setSubmitLoading(false);
          setFeedback({ type: "err", text: noteErr.message });
          return;
        }
      }
      const convResult = await sendRequestConversationMessage({
        supabase,
        requestId,
        authorId: userData.user.id,
        authorRole: "patient",
        text: noteTrim,
        pendingAudio: pendingAudio ?? undefined,
      });
      if (!convResult.ok) {
        setSubmitLoading(false);
        setFeedback({
          type: "err",
          text: tp("voiceConvFailed"),
        });
        router.push(`/dashboard/demandes/${requestId}`);
        return;
      }
      void supabase.rpc("mark_request_conversation_read", { p_request_id: requestId });
    }

    setSubmitLoading(false);
    router.push(`/dashboard/demandes/${requestId}`);
  };

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">{tp("sessionCheck")}</p>
      </main>
    );
  }

  const pagesWord = pages.length > 1 ? tp("pages") : tp("page");

  return (
    <main
      className={cn(
        "min-h-screen touch-pan-y bg-background p-4 text-foreground antialiased sm:p-5",
        stickyFooterPadClass("standard")
      )}
    >
      <div className="mx-auto max-w-lg">
        <PharmacyPublicBackLink href={`/pharmacie/${pharmacyId}`}>{tp("backToPharmacy")}</PharmacyPublicBackLink>

        <PharmacyFlowHero
          theme="prescription"
          icon={FileText}
          eyebrow={tp("eyebrow")}
          title={tp("title")}
          subtitle={
            pharmacyName
              ? tp("subtitleWithPharmacy", { name: pharmacyName })
              : tp("subtitleGeneric")
          }
        />

        <section className={cn("mt-4 space-y-3 p-4", pharmacyPublicCard)}>
          <p className="text-sm font-semibold text-slate-900">{tp("photosSectionTitle")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-border text-foreground"
              onClick={() => cameraRef.current?.click()}
              disabled={pages.length >= MAX_PAGES}
            >
              <Camera className="size-4" aria-hidden />
              {tp("takePhoto")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-border text-foreground"
              onClick={() => fileRef.current?.click()}
              disabled={pages.length >= MAX_PAGES}
            >
              <FileImage className="size-4" aria-hidden />
              {tp("chooseFile")}
            </Button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {pages.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {pages.map((p, i) => (
                <li key={p.previewUrl} className="relative overflow-hidden rounded-xl border border-border/80">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt={tp("pageAlt", { n: i + 1 })} className="aspect-[3/4] w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePage(i)}
                    className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white"
                    aria-label={tp("removePageAria")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {tp("pageLabel", { n: i + 1 })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
              {tp("noPhotosYet")}
            </p>
          )}
        </section>

        <section className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">{tp("messageOptional")}</p>
          <div className="mt-2">
            <ConversationMessageDraftField
              draft={note}
              onDraftChange={setNote}
              maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
              onAudioDraftChange={setPendingAudio}
              placeholder={tp("messagePlaceholder")}
              counterClassName="text-[10px]"
              textareaClassName="w-full rounded-xl border-2 border-slate-200 p-3 text-sm"
            />
          </div>
        </section>

        {feedback ? (
          <p
            className={cn(
              "mt-4 rounded-lg p-3 text-sm",
              feedback.type === "err" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"
            )}
          >
            {feedback.text}
          </p>
        ) : null}
      </div>

      <PlatformStickyFooter tone="neutral" zIndex={10020}>
        <Button
          type="button"
          className={cn("h-10 w-full text-sm font-semibold", platformDashboardChrome.cta)}
          disabled={submitLoading}
          onClick={() => {
            const err = validate();
            if (err) {
              setFeedback({ type: "err", text: err });
              return;
            }
            setConfirmOpen(true);
          }}
        >
          {submitLoading ? tc("sending") : tp("sendPrescription")}
        </Button>
      </PlatformStickyFooter>

      <AppModalOverlay
        open={confirmOpen}
        onBackdropClick={() => {
          if (!submitLoading) setConfirmOpen(false);
        }}
        aria-labelledby="ordonnance-send-confirm-title"
      >
        <div
          className="flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-300/70 bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-amber-200/80 bg-amber-50/60 px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="ordonnance-send-confirm-title" className="text-lg font-bold leading-tight text-amber-950">
                  {tp("confirmSend")}
                </h2>
                <p className="mt-1 text-sm text-amber-900/85">
                  {tp("confirmSendHint", { count: pages.length, pagesWord })}
                </p>
              </div>
              <button
                type="button"
                disabled={submitLoading}
                className="rounded-lg p-1 text-amber-800/70 hover:bg-amber-100/80 hover:text-amber-950 disabled:opacity-40"
                onClick={() => setConfirmOpen(false)}
                aria-label={tc("closeAria")}
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {note.trim() ? (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/80">
                  {tp("yourMessageForPharmacy")}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note.trim()}</p>
              </div>
            ) : null}
            {pendingAudio ? (
              <ConversationAudioDraftPreview draft={pendingAudio} className="mt-3 border-amber-200/70 bg-amber-50/40" />
            ) : null}
            {!note.trim() && !pendingAudio ? (
              <p className="text-sm text-muted-foreground">{tp("noMessageLater")}</p>
            ) : null}
          </div>
          <div className="border-t border-amber-200/60 bg-muted/25 px-4 py-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 font-semibold"
                disabled={submitLoading}
                onClick={() => setConfirmOpen(false)}
              >
                {tc("cancel")}
              </Button>
              <Button
                type="button"
                className={cn("h-11 flex-1 font-semibold", platformDashboardChrome.cta)}
                disabled={submitLoading}
                onClick={() => void submit()}
              >
                {submitLoading ? tc("sending") : tp("confirmSendButton")}
              </Button>
            </div>
          </div>
        </div>
      </AppModalOverlay>
    </main>
  );
}

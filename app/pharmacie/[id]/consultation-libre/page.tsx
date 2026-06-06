"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, FileImage, MessageSquare, Trash2 } from "lucide-react";
import { PharmacyFlowHero, PharmacyPublicBackLink, pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import { platformDashboardChrome } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CONSULTATION_MAX_PHOTOS,
  compressImageFileForConsultation,
  pathsToAttachPayload,
  uploadConsultationPhotoBlob,
} from "@/lib/consultation-media";
import { preparePatientRequestPhoto } from "@/lib/patient-request-photo-upload";
import { CONSULTATION_TEXT_MAX, CONSULTATION_TEXT_MIN } from "@/lib/patient-request-form-limits";
import { sendRequestConversationMessage } from "@/lib/send-request-conversation-message";
import { ConversationMessageDraftField } from "@/components/requests/conversation/conversation-message-draft-field";
import type { ConversationAudioDraft } from "@/lib/use-conversation-audio-recorder";

type PhotoSlot = { slot: 1 | 2 | 3; file?: File; previewUrl: string };

export default function ConsultationLibrePage() {
  const tc = useTranslations("consultationPublic");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const pharmacyId = typeof params.id === "string" ? params.id : "";

  const [pharmacyName, setPharmacyName] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [text, setText] = useState("");
  const [pendingAudio, setPendingAudio] = useState<ConversationAudioDraft | null>(null);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace(`/auth?redirect=/pharmacie/${pharmacyId}/consultation-libre`);
        return;
      }
      setSessionReady(true);
    })();
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

  const revokePreviews = useCallback((slots: PhotoSlot[]) => {
    for (const s of slots) {
      if (s.previewUrl.startsWith("blob:")) URL.revokeObjectURL(s.previewUrl);
    }
  }, []);

  useEffect(() => () => revokePreviews(photos), [photos, revokePreviews]);

  const addFiles = async (files: FileList | File[]) => {
    setFeedback(null);
    const list = Array.from(files);
    const remaining = CONSULTATION_MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      setFeedback({ type: "err", text: tc("maxPhotosError", { max: CONSULTATION_MAX_PHOTOS }) });
      return;
    }
    const used = new Set(photos.map((p) => p.slot));
    const free = ([1, 2, 3] as const).filter((s) => !used.has(s));
    const next: PhotoSlot[] = [...photos];
    for (const f of list.slice(0, remaining)) {
      const prepared = await preparePatientRequestPhoto(f, compressImageFileForConsultation);
      if (!prepared.ok) {
        setFeedback({ type: "err", text: prepared.error });
        return;
      }
      const slot = free.shift()!;
      const previewFile = new File([prepared.blob], `photo${slot}.webp`, { type: "image/webp" });
      next.push({ slot, file: previewFile, previewUrl: URL.createObjectURL(previewFile) });
    }
    setPhotos(next);
  };

  const removePhoto = (slot: 1 | 2 | 3) => {
    setPhotos((prev) => {
      const copy = prev.filter((p) => p.slot !== slot);
      const removed = prev.find((p) => p.slot === slot);
      if (removed?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const submit = async () => {
    setFeedback(null);
    const trimmed = text.trim();
    if (trimmed.length < CONSULTATION_TEXT_MIN) {
      setFeedback({ type: "err", text: tc("textTooShort", { min: CONSULTATION_TEXT_MIN }) });
      return;
    }
    setSubmitLoading(true);
    const { data: requestId, error: rpcErr } = await supabase.rpc("patient_submit_free_consultation_request", {
      p_pharmacy_id: pharmacyId,
      p_consultation_text: trimmed,
    });
    if (rpcErr || !requestId) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: rpcErr?.message ?? tc("submitFailed") });
      return;
    }
    const rid = String(requestId);
    const paths = { photo1: null as string | null, photo2: null as string | null, photo3: null as string | null };
    for (const p of photos) {
      if (!p.file) continue;
      const { path, error: upErr } = await uploadConsultationPhotoBlob(rid, p.slot, p.file);
      if (upErr) {
        setSubmitLoading(false);
        setFeedback({ type: "err", text: upErr });
        return;
      }
      if (p.slot === 1) paths.photo1 = path;
      if (p.slot === 2) paths.photo2 = path;
      if (p.slot === 3) paths.photo3 = path;
    }
    if (paths.photo1 || paths.photo2 || paths.photo3) {
      const { error: attachErr } = await supabase.rpc("patient_attach_consultation_images", {
        p_request_id: rid,
        p_initial_submit: true,
        ...pathsToAttachPayload(paths),
      });
      if (attachErr) {
        setSubmitLoading(false);
        setFeedback({ type: "err", text: attachErr.message });
        return;
      }
    }
    if (pendingAudio) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setSubmitLoading(false);
        setFeedback({ type: "err", text: tc("sessionExpired") });
        return;
      }
      const convResult = await sendRequestConversationMessage({
        supabase,
        requestId: rid,
        authorId: userData.user.id,
        authorRole: "patient",
        text: "",
        pendingAudio,
      });
      if (!convResult.ok) {
        setSubmitLoading(false);
        setFeedback({
          type: "err",
          text: tc("voiceConvFailed"),
        });
        router.push(`/dashboard/demandes/${rid}`);
        return;
      }
      void supabase.rpc("mark_request_conversation_read", { p_request_id: rid });
    }
    setSubmitLoading(false);
    router.push(`/dashboard/demandes/${rid}`);
  };

  if (!sessionReady) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
        <p className="text-sm text-muted-foreground">{tc("sessionCheck")}</p>
      </main>
    );
  }

  return (
    <main className={cn("mx-auto min-h-screen max-w-lg bg-background px-4 py-6")}>
      <PharmacyPublicBackLink href={`/pharmacie/${pharmacyId}`}>
        {pharmacyName || tc("backFallback")}
      </PharmacyPublicBackLink>
      <PharmacyFlowHero
        theme="consultation"
        icon={MessageSquare}
        eyebrow={tc("eyebrow")}
        title={tc("title")}
        subtitle={tc("subtitle")}
      />

      <section className={cn("mt-5 space-y-4 p-4", pharmacyPublicCard)}>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tc("yourMessage")}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={CONSULTATION_TEXT_MAX}
            rows={6}
            placeholder={tc("messagePlaceholder")}
            className="mt-1.5 w-full rounded-lg border border-input px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground tabular-nums">
            {tc("charCounter", {
              current: text.trim().length,
              max: CONSULTATION_TEXT_MAX,
              min: CONSULTATION_TEXT_MIN,
            })}
          </span>
        </label>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tc("voiceOptional")}</p>
          <div className="mt-1.5">
            <ConversationMessageDraftField
              draft=""
              onDraftChange={() => {}}
              textEnabled={false}
              showCounter={false}
              onAudioDraftChange={setPendingAudio}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {tc("photosOptional", { max: CONSULTATION_MAX_PHOTOS })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.slot} className="relative size-24 overflow-hidden rounded-xl border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.slot)}
                  className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white"
                  aria-label={tc("removePhotoAria")}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          {photos.length < CONSULTATION_MAX_PHOTOS ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-xs font-semibold text-foreground"
              >
                <Camera className="size-4" /> {tc("camera")}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-xs font-semibold text-foreground"
              >
                <FileImage className="size-4" /> {tc("gallery")}
              </button>
            </div>
          ) : null}
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
            multiple
            className="hidden"
            onChange={(e) => {
              const f = e.target.files;
              if (f?.length) void addFiles(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {feedback ? (
        <p
          className={cn(
            "mt-3 rounded-lg p-2.5 text-sm",
            feedback.type === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"
          )}
        >
          {feedback.text}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={submitLoading}
        onClick={() => void submit()}
        className={cn("mt-5 w-full py-6 text-base font-semibold", platformDashboardChrome.cta)}
      >
        <MessageSquare className="mr-2 size-5" aria-hidden />
        {submitLoading ? tCommon("sending") : tc("sendConsultation")}
      </Button>
    </main>
  );
}

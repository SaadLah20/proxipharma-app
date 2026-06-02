"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { CONSULTATION_TEXT_MAX, CONSULTATION_TEXT_MIN } from "@/lib/patient-request-form-limits";

type PhotoSlot = { slot: 1 | 2 | 3; file?: File; previewUrl: string };

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export default function ConsultationLibrePage() {
  const params = useParams();
  const router = useRouter();
  const pharmacyId = typeof params.id === "string" ? params.id : "";

  const [pharmacyName, setPharmacyName] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [text, setText] = useState("");
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
      setFeedback({ type: "err", text: `Maximum ${CONSULTATION_MAX_PHOTOS} photos.` });
      return;
    }
    const used = new Set(photos.map((p) => p.slot));
    const free = ([1, 2, 3] as const).filter((s) => !used.has(s));
    const next: PhotoSlot[] = [...photos];
    for (const f of list.slice(0, remaining)) {
      if (!f.type.startsWith("image/")) {
        setFeedback({ type: "err", text: "Formats acceptés : JPEG, PNG, WebP." });
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFeedback({ type: "err", text: "Chaque image doit faire moins de 8 Mo." });
        return;
      }
      try {
        const blob = await compressImageFileForConsultation(f);
        const slot = free.shift()!;
        const previewFile = new File([blob], `photo${slot}.webp`, { type: "image/webp" });
        next.push({ slot, file: previewFile, previewUrl: URL.createObjectURL(previewFile) });
      } catch (e) {
        setFeedback({ type: "err", text: e instanceof Error ? e.message : "Image illisible." });
        return;
      }
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
    const t = text.trim();
    if (t.length < CONSULTATION_TEXT_MIN) {
      setFeedback({ type: "err", text: `Décrivez votre besoin en au moins ${CONSULTATION_TEXT_MIN} caractères.` });
      return;
    }
    setSubmitLoading(true);
    const { data: requestId, error: rpcErr } = await supabase.rpc("patient_submit_free_consultation_request", {
      p_pharmacy_id: pharmacyId,
      p_consultation_text: t,
    });
    if (rpcErr || !requestId) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: rpcErr?.message ?? "Échec de l’envoi." });
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
        ...pathsToAttachPayload(paths),
      });
      if (attachErr) {
        setSubmitLoading(false);
        setFeedback({ type: "err", text: attachErr.message });
        return;
      }
    }
    setSubmitLoading(false);
    router.push(`/dashboard/demandes/${rid}`);
  };

  if (!sessionReady) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  return (
    <main className={cn("mx-auto min-h-screen max-w-lg bg-background px-4 py-6")}>
      <PharmacyPublicBackLink href={`/pharmacie/${pharmacyId}`}>{pharmacyName || "Pharmacie"}</PharmacyPublicBackLink>
      <PharmacyFlowHero
        theme="consultation"
        icon={MessageSquare}
        eyebrow="Consultation"
        title="Consultation libre"
        subtitle="Décrivez votre besoin. La pharmacie pourra échanger avec vous puis vous proposer des produits."
      />

      <section className={cn("mt-5 space-y-4 p-4", pharmacyPublicCard)}>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Votre message</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={CONSULTATION_TEXT_MAX}
            rows={6}
            placeholder="Symptômes, contexte, produits recherchés…"
            className="mt-1.5 w-full rounded-lg border border-input px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground tabular-nums">
            {text.trim().length}/{CONSULTATION_TEXT_MAX} · min. {CONSULTATION_TEXT_MIN}
          </span>
        </label>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Photos (facultatif, {CONSULTATION_MAX_PHOTOS} max)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.slot} className="relative size-24 overflow-hidden rounded-xl border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.slot)}
                  className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white"
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
                <Camera className="size-4" /> Appareil
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2.5 text-xs font-semibold text-foreground"
              >
                <FileImage className="size-4" /> Galerie
              </button>
            </div>
          ) : null}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files; if (f?.length) void addFiles(f); e.target.value = ""; }} />
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = e.target.files; if (f?.length) void addFiles(f); e.target.value = ""; }} />
        </div>
      </section>

      {feedback ? (
        <p className={cn("mt-3 rounded-lg p-2.5 text-sm", feedback.type === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800")}>
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
        {submitLoading ? "Envoi…" : "Envoyer la consultation"}
      </Button>
    </main>
  );
}

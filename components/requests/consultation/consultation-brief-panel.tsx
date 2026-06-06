"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileImage, Maximize2, Pencil, Trash2 } from "lucide-react";
import { ConsultationPhotoLightbox } from "@/components/requests/consultation/consultation-photo-lightbox";
import { supabase } from "@/lib/supabase";
import {
  CONSULTATION_MAX_PHOTOS,
  type ConsultationImagePaths,
  compressImageFileForConsultation,
  createConsultationSignedUrl,
  pathsToAttachPayload,
  uploadConsultationPhotoBlob,
} from "@/lib/consultation-media";
import { CONSULTATION_TEXT_MAX, CONSULTATION_TEXT_MIN } from "@/lib/patient-request-form-limits";

type PhotoSlot = { slot: 1 | 2 | 3; previewUrl: string; path: string | null; isNew?: boolean };

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function ConsultationBriefPanel({
  requestId,
  initialText,
  initialPaths,
  editable,
  viewerRole = "patient",
  accent = "violet",
  onSaved,
}: {
  requestId: string;
  initialText: string;
  initialPaths: ConsultationImagePaths;
  editable: boolean;
  viewerRole?: "patient" | "pharmacien";
  accent?: "violet";
  onSaved?: () => void | Promise<void>;
}) {
  const [localText, setLocalText] = useState<string | null>(null);
  const [prevInitialText, setPrevInitialText] = useState(initialText);
  if (prevInitialText !== initialText) {
    setPrevInitialText(initialText);
    setLocalText(null);
  }
  const displayText = localText ?? initialText;
  const [textDraft, setTextDraft] = useState(displayText);
  const [editingText, setEditingText] = useState(false);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [lightbox, setLightbox] = useState<{ label: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shell =
    accent === "violet"
      ? "rounded-xl border-2 border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-white to-fuchsia-50/25 p-3 shadow-sm ring-1 ring-violet-200/45"
      : "rounded-xl border border-border bg-card p-3";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const slots: (1 | 2 | 3)[] = [1, 2, 3];
      const keys: (keyof ConsultationImagePaths)[] = ["photo1", "photo2", "photo3"];
      const next: PhotoSlot[] = [];
      const loadErrors: string[] = [];
      for (let i = 0; i < slots.length; i++) {
        const path = initialPaths[keys[i]];
        if (!path) continue;
        const { url, error } = await createConsultationSignedUrl(path);
        if (url) next.push({ slot: slots[i], previewUrl: url, path });
        else if (error) loadErrors.push(error);
      }
      if (cancelled) return;
      setPhotos(next);
      if (loadErrors.length > 0) {
        setFeedback(
          viewerRole === "pharmacien"
            ? "Impossible d’afficher une ou plusieurs photos (droits ou fichier manquant)."
            : loadErrors[0]!
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPaths, viewerRole]);

  const persistPaths = async (nextPaths: ConsultationImagePaths) => {
    const { error } = await supabase.rpc("patient_attach_consultation_images", {
      p_request_id: requestId,
      ...pathsToAttachPayload(nextPaths),
    });
    if (error) throw new Error(error.message);
  };

  const pathsFromPhotos = (list: PhotoSlot[]): ConsultationImagePaths => {
    const out: ConsultationImagePaths = { photo1: null, photo2: null, photo3: null };
    for (const p of list) {
      const key = `photo${p.slot}` as keyof ConsultationImagePaths;
      out[key] = p.path;
    }
    return out;
  };

  const saveText = async () => {
    setFeedback("");
    const t = textDraft.trim();
    if (t.length < CONSULTATION_TEXT_MIN) {
      setFeedback(`Minimum ${CONSULTATION_TEXT_MIN} caractères (le texte ne peut pas être vide).`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("patient_update_consultation_text", {
      p_request_id: requestId,
      p_consultation_text: t,
    });
    setBusy(false);
    if (error) {
      setFeedback(error.message);
      return;
    }
    setLocalText(t);
    setEditingText(false);
    await onSaved?.();
  };

  const addFiles = async (files: FileList | File[]) => {
    if (!editable) return;
    setFeedback("");
    const list = Array.from(files);
    const used = new Set(photos.map((p) => p.slot));
    const free: (1 | 2 | 3)[] = ([1, 2, 3] as const).filter((s) => !used.has(s));
    if (free.length === 0) {
      setFeedback(`Maximum ${CONSULTATION_MAX_PHOTOS} photos.`);
      return;
    }
    setBusy(true);
    try {
      const added: PhotoSlot[] = [...photos];
      for (const f of list.slice(0, free.length)) {
        if (!f.type.startsWith("image/")) throw new Error("Formats acceptés : JPEG, PNG, WebP.");
        if (f.size > MAX_FILE_BYTES) throw new Error("Chaque image doit faire moins de 8 Mo.");
        const slot = free.shift()!;
        const blob = await compressImageFileForConsultation(f);
        const { path, error: upErr } = await uploadConsultationPhotoBlob(requestId, slot, blob);
        if (upErr) throw new Error(upErr);
        added.push({ slot, previewUrl: URL.createObjectURL(blob), path, isNew: true });
      }
      await persistPaths(pathsFromPhotos(added));
      setPhotos(added);
      await onSaved?.();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Erreur photo.");
    }
    setBusy(false);
  };

  const removePhoto = async (slot: 1 | 2 | 3) => {
    if (!editable) return;
    setBusy(true);
    setFeedback("");
    try {
      const next = photos.filter((p) => p.slot !== slot);
      await persistPaths(pathsFromPhotos(next));
      setPhotos(next);
      await onSaved?.();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Erreur.");
    }
    setBusy(false);
  };

  return (
    <section className={shell}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-900/80">
            {viewerRole === "pharmacien" ? "Message du patient" : "Votre consultation"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {editable
              ? "Modifiez le texte ou les photos ; la pharmacie verra la version à jour."
              : viewerRole === "pharmacien"
                ? "Texte et photos transmis au départ du dossier."
                : "Message et photos envoyés au départ du dossier."}
          </p>
        </div>
        {editable && !editingText ? (
          <button
            type="button"
            onClick={() => {
              setTextDraft(displayText);
              setEditingText(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-[10px] font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
          >
            <Pencil className="size-3" aria-hidden />
            Modifier le texte
          </button>
        ) : null}
      </div>

      {editingText && editable ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            maxLength={CONSULTATION_TEXT_MAX}
            rows={5}
            className="w-full rounded-lg border border-violet-200/80 bg-white px-2.5 py-2 text-sm text-foreground shadow-inner"
          />
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {textDraft.length}/{CONSULTATION_TEXT_MAX} · min. {CONSULTATION_TEXT_MIN}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveText()}
              className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              Enregistrer le texte
            </button>
            <button
              type="button"
              onClick={() => {
                setTextDraft(displayText);
                setEditingText(false);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{displayText}</p>
      )}

      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-950/90">Photos (facultatif)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.length === 0 &&
          (initialPaths.photo1 || initialPaths.photo2 || initialPaths.photo3) &&
          !editable &&
          !feedback ? (
            <p className="text-[11px] text-muted-foreground">Chargement des photos…</p>
          ) : null}
          {photos.map((p) => (
            <div key={p.slot} className="relative size-24 overflow-hidden rounded-lg border border-violet-200/70 bg-muted shadow-sm sm:size-28">
              <button
                type="button"
                title={`Agrandir la photo ${p.slot}`}
                onClick={() => setLightbox({ label: `Photo ${p.slot}`, url: p.previewUrl })}
                className="block size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.previewUrl} alt="" className="size-full object-cover" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-gradient-to-t from-black/55 to-transparent py-1 text-[9px] font-semibold text-white">
                  <Maximize2 className="size-3" aria-hidden />
                  Agrandir
                </span>
              </button>
              {editable ? (
                <button
                  type="button"
                  title="Supprimer"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void removePhoto(p.slot);
                  }}
                  className="absolute right-0.5 top-0.5 z-10 rounded bg-black/55 p-0.5 text-white hover:bg-black/70"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {photos.length > 0 ? (
          <p className="mt-1.5 text-[10px] text-muted-foreground">Touchez une photo pour l’afficher en plein écran.</p>
        ) : null}
        {editable && photos.length < CONSULTATION_MAX_PHOTOS ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-violet-900"
            >
              <Camera className="size-3.5" /> Photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-violet-900"
            >
              <FileImage className="size-3.5" /> Galerie
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
              multiple
              className="hidden"
              onChange={(e) => {
                const f = e.target.files;
                if (f?.length) void addFiles(f);
                e.target.value = "";
              }}
            />
          </div>
        ) : null}
      </div>

      {feedback ? <p className="mt-2 text-[11px] text-red-700">{feedback}</p> : null}

      {lightbox ? (
        <ConsultationPhotoLightbox label={lightbox.label} url={lightbox.url} onClose={() => setLightbox(null)} />
      ) : null}
    </section>
  );
}

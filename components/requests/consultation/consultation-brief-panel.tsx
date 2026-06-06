"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, FileImage, Maximize2, Pencil, Trash2 } from "lucide-react";
import { clsx } from "clsx";
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

type PhotoSlot = {
  slot: 1 | 2 | 3;
  previewUrl: string;
  path: string | null;
  pendingFile?: Blob;
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function pathsEqual(a: ConsultationImagePaths, b: ConsultationImagePaths): boolean {
  return (
    (a.photo1 ?? "") === (b.photo1 ?? "") &&
    (a.photo2 ?? "") === (b.photo2 ?? "") &&
    (a.photo3 ?? "") === (b.photo3 ?? "")
  );
}

function pathsFromPhotos(list: PhotoSlot[]): ConsultationImagePaths {
  const out: ConsultationImagePaths = { photo1: null, photo2: null, photo3: null };
  for (const p of list) {
    const key = `photo${p.slot}` as keyof ConsultationImagePaths;
    out[key] = p.path;
  }
  return out;
}

export function ConsultationBriefPanel({
  requestId,
  initialText,
  initialPaths,
  editable,
  viewerRole = "patient",
  accent = "violet",
  onSaved,
  defaultExpanded = false,
}: {
  requestId: string;
  initialText: string;
  initialPaths: ConsultationImagePaths;
  editable: boolean;
  viewerRole?: "patient" | "pharmacien";
  accent?: "violet";
  onSaved?: () => void | Promise<void>;
  /** Patient : panneau replié jusqu’au clic « Modifier ». */
  defaultExpanded?: boolean;
}) {
  const panelKey = `${requestId}|${initialText}|${initialPaths.photo1 ?? ""}|${initialPaths.photo2 ?? ""}|${initialPaths.photo3 ?? ""}`;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [textDraft, setTextDraft] = useState(initialText);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [lightbox, setLightbox] = useState<{ label: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef = useRef<string[]>([]);

  const shell =
    accent === "violet"
      ? "rounded-xl border-2 border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-white to-fuchsia-50/25 shadow-sm ring-1 ring-violet-200/45"
      : "rounded-xl border border-border bg-card";

  useEffect(() => {
    setTextDraft(initialText);
    setExpanded(defaultExpanded);
    setFeedback("");
    blobUrlsRef.current.forEach((u) => {
      if (u.startsWith("blob:")) URL.revokeObjectURL(u);
    });
    blobUrlsRef.current = [];
    setPhotos([]);
    setPhotosLoading(true);

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
      setPhotosLoading(false);
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
  }, [panelKey, initialPaths, initialText, defaultExpanded, viewerRole]);

  useEffect(
    () => () => {
      blobUrlsRef.current.forEach((u) => {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
      });
    },
    []
  );

  const draftPaths = useMemo(() => pathsFromPhotos(photos), [photos]);
  const isDirty =
    editable &&
    (textDraft.trim() !== initialText.trim() || !pathsEqual(draftPaths, initialPaths) || photos.some((p) => p.pendingFile));

  const resetDraft = () => {
    setTextDraft(initialText);
    setFeedback("");
    blobUrlsRef.current.forEach((u) => {
      if (u.startsWith("blob:")) URL.revokeObjectURL(u);
    });
    blobUrlsRef.current = [];
    setPhotos([]);
    setPhotosLoading(true);
    void (async () => {
      const slots: (1 | 2 | 3)[] = [1, 2, 3];
      const keys: (keyof ConsultationImagePaths)[] = ["photo1", "photo2", "photo3"];
      const next: PhotoSlot[] = [];
      for (let i = 0; i < slots.length; i++) {
        const path = initialPaths[keys[i]];
        if (!path) continue;
        const { url } = await createConsultationSignedUrl(path);
        if (url) next.push({ slot: slots[i], previewUrl: url, path });
      }
      setPhotos(next);
      setPhotosLoading(false);
    })();
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
    try {
      const added: PhotoSlot[] = [...photos];
      for (const f of list.slice(0, free.length)) {
        if (!f.type.startsWith("image/")) throw new Error("Formats acceptés : JPEG, PNG, WebP.");
        if (f.size > MAX_FILE_BYTES) throw new Error("Chaque image doit faire moins de 8 Mo.");
        const slot = free.shift()!;
        const blob = await compressImageFileForConsultation(f);
        const previewUrl = URL.createObjectURL(blob);
        blobUrlsRef.current.push(previewUrl);
        added.push({ slot, previewUrl, path: null, pendingFile: blob });
      }
      setPhotos(added);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Erreur photo.");
    }
  };

  const removePhoto = (slot: 1 | 2 | 3) => {
    if (!editable) return;
    setPhotos((prev) => {
      const removed = prev.find((p) => p.slot === slot);
      if (removed?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(removed.previewUrl);
        blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== removed.previewUrl);
      }
      return prev.filter((p) => p.slot !== slot);
    });
  };

  const saveAll = async () => {
    if (!editable || !isDirty) return;
    setFeedback("");
    const t = textDraft.trim();
    if (t.length < CONSULTATION_TEXT_MIN) {
      setFeedback(`Minimum ${CONSULTATION_TEXT_MIN} caractères (le texte ne peut pas être vide).`);
      return;
    }
    setBusy(true);
    try {
      const nextPhotos: PhotoSlot[] = [];
      for (const p of photos) {
        if (p.pendingFile) {
          const { path, error: upErr } = await uploadConsultationPhotoBlob(requestId, p.slot, p.pendingFile);
          if (upErr) throw new Error(upErr);
          nextPhotos.push({ slot: p.slot, previewUrl: p.previewUrl, path });
        } else {
          nextPhotos.push(p);
        }
      }
      const paths = pathsFromPhotos(nextPhotos);
      const { error } = await supabase.rpc("patient_save_consultation_brief", {
        p_request_id: requestId,
        p_consultation_text: t,
        ...pathsToAttachPayload(paths),
      });
      if (error) throw new Error(error.message);
      setExpanded(false);
      await onSaved?.();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Erreur lors de l’enregistrement.");
    }
    setBusy(false);
  };

  const readonlyBody = (
    <>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{initialText}</p>
      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-950/90">Photos (facultatif)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {photosLoading && (initialPaths.photo1 || initialPaths.photo2 || initialPaths.photo3) ? (
            <p className="text-[11px] text-muted-foreground">Chargement des photos…</p>
          ) : null}
          {photos.map((p) => (
            <button
              key={p.slot}
              type="button"
              title={`Agrandir la photo ${p.slot}`}
              onClick={() => setLightbox({ label: `Photo ${p.slot}`, url: p.previewUrl })}
              className="relative size-24 overflow-hidden rounded-lg border border-violet-200/70 bg-muted shadow-sm sm:size-28"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </>
  );

  const editableBody = (
    <div className="mt-2 space-y-3 border-t border-violet-200/60 pt-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-950/90">Message</p>
        <textarea
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          maxLength={CONSULTATION_TEXT_MAX}
          rows={5}
          disabled={busy}
          className="mt-1.5 w-full rounded-lg border border-violet-200/80 bg-white px-2.5 py-2 text-sm text-foreground shadow-inner disabled:opacity-60"
        />
        <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
          {textDraft.length}/{CONSULTATION_TEXT_MAX} · min. {CONSULTATION_TEXT_MIN}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-950/90">Photos (facultatif)</p>
        <div className="mt-2 flex flex-wrap gap-2">
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
              </button>
              <button
                type="button"
                title="Retirer (enregistrez pour valider)"
                disabled={busy}
                onClick={() => removePhoto(p.slot)}
                className="absolute right-0.5 top-0.5 z-10 rounded bg-black/55 p-0.5 text-white hover:bg-black/70 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        {photos.length < CONSULTATION_MAX_PHOTOS ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-violet-900 disabled:opacity-50"
            >
              <Camera className="size-3.5" /> Photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-violet-900 disabled:opacity-50"
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
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Ajouts et suppressions sont pris en compte après « Enregistrer les modifications ».
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !isDirty}
          onClick={() => void saveAll()}
          className="rounded-md bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            resetDraft();
            setExpanded(false);
          }}
          className="rounded-md border border-border px-3 py-2 text-xs font-medium disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );

  if (!editable) {
    return (
      <section className={clsx(shell, "p-3")}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-900/80">
            {viewerRole === "pharmacien" ? "Message du patient" : "Votre consultation"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {viewerRole === "pharmacien"
              ? "Texte et photos transmis au départ du dossier."
              : "Message et photos envoyés au départ du dossier."}
          </p>
        </div>
        {readonlyBody}
        {feedback ? <p className="mt-2 text-[11px] text-red-700">{feedback}</p> : null}
        {lightbox ? (
          <ConsultationPhotoLightbox label={lightbox.label} url={lightbox.url} onClose={() => setLightbox(null)} />
        ) : null}
      </section>
    );
  }

  return (
    <section className={clsx(shell, "overflow-hidden")}>
      <button
        type="button"
        onClick={() => {
          if (expanded && isDirty) {
            resetDraft();
          }
          setExpanded((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-900/80">Modifier mon message</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {expanded
              ? "Texte et photos — une seule validation pour la pharmacie."
              : "Toucher pour modifier le texte ou les photos."}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-[10px] font-semibold text-violet-900 shadow-sm">
          {expanded ? null : <Pencil className="size-3" aria-hidden />}
          {expanded ? "Replier" : "Ouvrir"}
          <ChevronDown className={clsx("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </span>
      </button>

      {expanded ? <div className="px-3 pb-3">{editableBody}</div> : null}

      {feedback ? <p className="px-3 pb-3 text-[11px] text-red-700">{feedback}</p> : null}

      {lightbox ? (
        <ConsultationPhotoLightbox label={lightbox.label} url={lightbox.url} onClose={() => setLightbox(null)} />
      ) : null}
    </section>
  );
}

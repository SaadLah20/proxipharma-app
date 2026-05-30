"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, FileImage, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { PlatformStickyFooter } from "@/components/layout/platform-sticky-footer";
import { stickyFooterPadClass } from "@/lib/platform-sticky-footer";
import { cn } from "@/lib/utils";
import {
  compressImageFileForPrescription,
  uploadPrescriptionPageBlob,
} from "@/lib/prescription-media";
import { REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";

type PageSlot = {
  file: File;
  previewUrl: string;
};

const MAX_PAGES = 2;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export default function DemandeOrdonnancePage() {
  const params = useParams();
  const router = useRouter();
  const pharmacyId = typeof params.id === "string" ? params.id : "";

  const [pharmacyName, setPharmacyName] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [pages, setPages] = useState<PageSlot[]>([]);
  const [note, setNote] = useState("");
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
      setFeedback({ type: "err", text: "Maximum 2 pages (recto / verso ou 2 feuilles)." });
      return;
    }
    const toAdd = list.slice(0, remaining);
    const next: PageSlot[] = [];
    for (const f of toAdd) {
      if (!f.type.startsWith("image/")) {
        setFeedback({ type: "err", text: "Formats acceptés : photos (JPEG, PNG, WebP)." });
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFeedback({ type: "err", text: "Chaque image doit faire moins de 8 Mo." });
        return;
      }
      try {
        const compressed = await compressImageFileForPrescription(f);
        const previewFile = new File([compressed], f.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
        next.push({ file: previewFile, previewUrl: URL.createObjectURL(previewFile) });
      } catch (e) {
        setFeedback({ type: "err", text: e instanceof Error ? e.message : "Image illisible." });
        return;
      }
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
    if (pages.length < 1) return "Ajoutez au moins une photo de l’ordonnance.";
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
      setFeedback({ type: "err", text: "Session expirée. Reconnecte-toi." });
      return;
    }

    setSubmitLoading(true);

    const noteTrim = note.trim().slice(0, REQUEST_CONVERSATION_MESSAGE_MAX);
    const { data: requestIdRaw, error: rpcErr } = await supabase.rpc("patient_submit_prescription_request", {
      p_pharmacy_id: pharmacyId,
      p_patient_note: noteTrim.length > 0 ? noteTrim : null,
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
      setFeedback({ type: "err", text: "Réponse serveur inattendue." });
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

    setSubmitLoading(false);
    router.push(`/dashboard/demandes/${requestId}`);
  };

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-amber-50/40 p-6">
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "min-h-screen touch-pan-y bg-gradient-to-b from-amber-50/80 to-slate-50 p-4 text-slate-900 antialiased sm:p-5",
        stickyFooterPadClass("standard")
      )}
    >
      <div className="mx-auto max-w-lg">
        <Link
          href={`/pharmacie/${pharmacyId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3 -ml-2 text-amber-900")}
        >
          ← Retour à la pharmacie
        </Link>

        <section className="rounded-2xl border-2 border-amber-200/80 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-bold text-amber-950">Envoyer une ordonnance</h1>
          <p className="mt-1 text-sm text-slate-600">
            {pharmacyName ? (
              <>
                Pharmacie <strong>{pharmacyName}</strong> — photo nette, bien éclairée (max. 2 pages).
              </>
            ) : (
              <>Photo nette, bien éclairée (max. 2 pages).</>
            )}
          </p>
        </section>

        <section className="mt-4 space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Photos de l’ordonnance</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-amber-300 text-amber-950"
              onClick={() => cameraRef.current?.click()}
              disabled={pages.length >= MAX_PAGES}
            >
              <Camera className="size-4" aria-hidden />
              Prendre une photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 border-amber-300 text-amber-950"
              onClick={() => fileRef.current?.click()}
              disabled={pages.length >= MAX_PAGES}
            >
              <FileImage className="size-4" aria-hidden />
              Choisir un fichier
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
                <li key={p.previewUrl} className="relative overflow-hidden rounded-xl border border-amber-200/70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePage(i)}
                    className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white"
                    aria-label="Supprimer cette page"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Page {i + 1}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-amber-200/80 bg-amber-50/50 p-4 text-center text-sm text-amber-950/80">
              Aucune photo pour le moment.
            </p>
          )}
        </section>

        <section className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-semibold text-slate-900">Message pour la pharmacie (facultatif)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
            className="mt-2 w-full rounded-xl border-2 border-slate-200 p-3 text-sm"
            placeholder="Ex. ordonnance pour mon enfant, urgence…"
          />
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

      <PlatformStickyFooter tone="amber" zIndex={10020}>
        <Button
          type="button"
          className="h-10 w-full bg-amber-700 text-sm font-semibold hover:bg-amber-800"
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
          {submitLoading ? "Envoi…" : "Envoyer l’ordonnance"}
        </Button>
      </PlatformStickyFooter>

      {confirmOpen ? (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div
              className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-4 shadow-xl"
              role="dialog"
              aria-modal="true"
            >
              <h2 className="text-base font-bold text-slate-900">Confirmer l’envoi ?</h2>
              <p className="mt-2 text-sm text-slate-600">
                {pages.length} page{pages.length > 1 ? "s" : ""} — la pharmacie saisira les produits après lecture.
              </p>
              <div className="mt-4 flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-amber-700 hover:bg-amber-800"
                  disabled={submitLoading}
                  onClick={() => void submit()}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          </div>
        ) : null}
    </main>
  );
}

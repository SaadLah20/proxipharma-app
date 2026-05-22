"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { clsx } from "clsx";
import { supabase } from "@/lib/supabase";

type Props = {
  pharmacyId: string;
  ratingAvg: number | null;
  ratingCount: number | null;
  onUpdated?: (avg: number, count: number) => void;
};

export function PharmacyRatingForm({ pharmacyId, ratingAvg, ratingCount, onUpdated }: Props) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadContext = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user?.id ?? null;
    setSessionUserId(uid);
    if (!uid) {
      setIsStaff(false);
      setScore(0);
      setComment("");
      return;
    }

    const [staffRes, ratingRes] = await Promise.all([
      supabase.from("pharmacy_staff").select("pharmacy_id").eq("user_id", uid).eq("pharmacy_id", pharmacyId).maybeSingle(),
      supabase
        .from("pharmacy_ratings")
        .select("score,comment")
        .eq("pharmacy_id", pharmacyId)
        .eq("author_id", uid)
        .maybeSingle(),
    ]);

    setIsStaff(!!staffRes.data);
    if (ratingRes.data) {
      setScore(ratingRes.data.score);
      setComment(ratingRes.data.comment ?? "");
    } else {
      setScore(0);
      setComment("");
    }
  }, [pharmacyId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const submit = async () => {
    if (!sessionUserId) return;
    if (score < 1 || score > 5) {
      setMessage("Choisissez une note de 1 à 5 étoiles.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("submit_pharmacy_rating", {
      p_pharmacy_id: pharmacyId,
      p_score: score,
      p_comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Merci, votre avis a été enregistré.");
    const { data: ph } = await supabase.from("pharmacies").select("rating_avg,rating_count").eq("id", pharmacyId).maybeSingle();
    if (ph) {
      onUpdated?.(Number(ph.rating_avg ?? 0), Number(ph.rating_count ?? 0));
    }
  };

  const displayAvg =
    (ratingCount ?? 0) > 0 ? `${Number(ratingAvg ?? 0).toFixed(1)} / 5 · ${ratingCount} avis` : "Pas encore d'avis";

  return (
    <section className="rounded-xl border border-border/80 bg-muted/10 p-3">
      <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Star className="size-3.5 text-amber-500" aria-hidden />
        Avis patients
      </h2>
      <p className="mt-1 text-[12px] font-semibold text-foreground">{displayAvg}</p>

      {!sessionUserId ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Link href={`/auth?redirect=/pharmacie/${pharmacyId}`} className="font-semibold text-primary underline">
            Connectez-vous
          </Link>{" "}
          pour noter cette officine (une note par compte).
        </p>
      ) : isStaff ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Les membres de l&apos;officine ne peuvent pas noter leur propre pharmacie.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex gap-1" role="group" aria-label="Note de 1 à 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                onClick={() => setScore(n)}
                className="rounded p-0.5 transition hover:scale-105 disabled:opacity-50"
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                aria-pressed={score >= n}
              >
                <Star
                  className={clsx(
                    "size-7",
                    score >= n ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40"
                  )}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <label className="block text-[11px] text-muted-foreground">
            Commentaire (optionnel, 500 car. max.)
            <textarea
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex. Accueil chaleureux, conseils utiles…"
            />
          </label>
          <button
            type="button"
            disabled={busy || score < 1}
            onClick={() => void submit()}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {score > 0 && comment ? "Mettre à jour mon avis" : "Publier mon avis"}
          </button>
        </div>
      )}

      {message ? <p className="mt-2 text-[11px] text-sky-900">{message}</p> : null}
    </section>
  );
}

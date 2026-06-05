"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Props = {
  pharmacyId: string;
  ratingAvg: number | null;
  ratingCount: number | null;
  onUpdated?: (avg: number, count: number) => void;
  embedded?: boolean;
};

function StarRow({
  value,
  onPick,
  disabled,
  size = "md",
  t,
}: {
  value: number;
  onPick?: (n: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  t: ReturnType<typeof useTranslations<"pharmacyPublic">>;
}) {
  const iconClass = size === "sm" ? "size-5" : "size-7";
  const readOnly = !onPick;
  return (
    <div
      className="flex gap-0.5"
      role={readOnly ? "img" : "group"}
      aria-label={readOnly ? t("ratingForm.ratingAria", { value }) : t("ratingForm.pickAria")}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled || readOnly}
          onClick={() => onPick?.(n)}
          className={clsx(
            "rounded p-0.5 transition",
            readOnly ? "cursor-default" : "hover:scale-105 disabled:opacity-50"
          )}
          aria-label={readOnly ? undefined : n > 1 ? t("ratingForm.starAriaPlural", { n }) : t("ratingForm.starAria", { n })}
          aria-pressed={!readOnly && value >= n}
          tabIndex={readOnly ? -1 : 0}
        >
          <Star
            className={clsx(
              iconClass,
              value >= n ? "fill-amber-400 text-amber-500" : "text-muted-foreground/35"
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

export function PharmacyRatingForm({ pharmacyId, ratingAvg, ratingCount, onUpdated, embedded }: Props) {
  const t = useTranslations("pharmacyPublic");
  const tc = useTranslations("common");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [savedScore, setSavedScore] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadContext = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user?.id ?? null;
    setSessionUserId(uid);
    if (!uid) {
      setIsStaff(false);
      setSavedScore(0);
      setEditing(false);
      return;
    }

    const [staffRes, ratingRes] = await Promise.all([
      supabase.from("pharmacy_staff").select("pharmacy_id").eq("user_id", uid).eq("pharmacy_id", pharmacyId).maybeSingle(),
      supabase.from("pharmacy_ratings").select("score").eq("pharmacy_id", pharmacyId).eq("author_id", uid).maybeSingle(),
    ]);

    setIsStaff(!!staffRes.data);
    const existing = ratingRes.data?.score ?? 0;
    setSavedScore(existing);
    setEditing(false);
  }, [pharmacyId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadContext();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadContext]);

  const submitScore = async (score: number) => {
    if (!sessionUserId || score < 1 || score > 5) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("submit_pharmacy_rating", {
      p_pharmacy_id: pharmacyId,
      p_score: score,
      p_comment: null,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSavedScore(score);
    setEditing(false);
    setMessage(score === savedScore ? "" : t("ratingForm.updated"));
    const { data: ph } = await supabase.from("pharmacies").select("rating_avg,rating_count").eq("id", pharmacyId).maybeSingle();
    if (ph) {
      onUpdated?.(Number(ph.rating_avg ?? 0), Number(ph.rating_count ?? 0));
    }
  };

  const displayAvg =
    (ratingCount ?? 0) > 0
      ? t("ratingSummary", {
          avg: Number(ratingAvg ?? 0).toFixed(1),
          count: ratingCount ?? 0,
        })
      : t("noReviewsYet");

  const hasUserRating = savedScore >= 1;

  return (
    <section
      className={cn(
        !embedded && pharmacyPublicCard,
        embedded ? "space-y-0" : "p-3 sm:p-4",
        !embedded && (hasUserRating && !editing ? "bg-muted/5" : "bg-muted/10")
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Star className="size-3.5 text-amber-500" aria-hidden />
          {t("patientRating")}
        </h2>
        <p className="text-[11px] font-semibold tabular-nums text-foreground">{displayAvg}</p>
      </div>

      {!sessionUserId ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Link href={`/auth?redirect=/pharmacie/${pharmacyId}`} className="font-semibold text-primary underline">
            {t("ratingForm.loginPrompt")}
          </Link>{" "}
          {t("ratingForm.loginSuffix")}
        </p>
      ) : isStaff ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("ratingForm.staffBlocked")}</p>
      ) : hasUserRating && !editing ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{t("ratingForm.yourRating")}</span>
            <StarRow value={savedScore} size="sm" t={t} />
            <span className="text-[11px] font-bold tabular-nums text-foreground">{savedScore}/5</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMessage("");
              setEditing(true);
            }}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground shadow-sm transition hover:bg-muted/50 disabled:opacity-50"
          >
            {t("ratingForm.editRating")}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {hasUserRating ? t("ratingForm.pickNew") : t("ratingForm.pickInitial")}
          </p>
          <StarRow value={savedScore} disabled={busy} onPick={(n) => void submitScore(n)} t={t} />
        </div>
      )}

      {message ? <p className="mt-2 text-[11px] font-medium text-emerald-800">{message}</p> : null}
      {busy ? <p className="mt-1 text-[10px] text-muted-foreground">{tc("saving")}</p> : null}
    </section>
  );
}

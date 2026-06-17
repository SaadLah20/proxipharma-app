"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PatientSettingsSection } from "@/components/patient/patient-settings-section";
import { supabase } from "@/lib/supabase";

export function PatientSettingsSessionSection() {
  const router = useRouter();
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const deleteAccount = async () => {
    setDeleteError("");
    if (!deleteAck) {
      setDeleteError(t("deleteConfirmCheckbox"));
      return;
    }
    if (deleteConfirm.trim().toUpperCase() !== "SUPPRIMER") {
      setDeleteError(t("deleteConfirmType"));
      return;
    }
    setDeleteLoading(true);
    const { data: auth } = await supabase.auth.getSession();
    const token = auth.session?.access_token;
    if (!token) {
      setDeleteLoading(false);
      setDeleteError(t("sessionExpired"));
      return;
    }
    try {
      const res = await fetch("/api/patient/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(body.error ?? t("deleteFailed"));
        setDeleteLoading(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t("networkError"));
      setDeleteLoading(false);
    }
  };

  return (
    <PatientSettingsSection title={t("accountSession")} subtitle={t("accountSessionSubtitle")} defaultOpen={false}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-foreground">{t("logoutTitle")}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("logoutHint")}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-4" aria-hidden />
            {t("logout")}
          </button>
        </div>

        <div className="border-t border-destructive/20 pt-4">
          <p className="text-xs font-semibold text-destructive">{t("deleteTitle")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("deleteHint")}</p>
          {!deleteOpen ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="mt-2 text-sm font-semibold text-destructive underline underline-offset-2"
            >
              {t("deleteStart")}
            </button>
          ) : (
            <div className="mt-3 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={deleteAck}
                  onChange={(e) => setDeleteAck(e.target.checked)}
                  className="mt-0.5 rounded border-input"
                />
                <span>{t("deleteAck")}</span>
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("deleteConfirmLabel")}
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={t("deleteConfirmPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-destructive/40 bg-background px-3 py-2 font-mono text-sm uppercase"
                  autoComplete="off"
                />
              </label>
              {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => void deleteAccount()}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-95 disabled:opacity-60"
                >
                  {deleteLoading ? t("deleteLoading") : t("deleteForever")}
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirm("");
                    setDeleteAck(false);
                    setDeleteError("");
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                >
                  {tc("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PatientSettingsSection>
  );
}

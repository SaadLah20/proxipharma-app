"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  patientLoginMethodsFromAuthAndProfile,
  type PatientLoginMethods,
} from "@/lib/patient-auth-login-methods-fr";
import { supabase } from "@/lib/supabase";

export type PatientSettingsProfile = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref?: string | null;
};

export function usePatientSettingsData() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientSettingsProfile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/patient/parametres");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const u = userData.user;
    setAuthUser(u ?? null);

    const { data: profileData, error: pe } = await supabase
      .from("profiles")
      .select("id,full_name,whatsapp,email,role,patient_ref")
      .eq("id", user.id)
      .maybeSingle();

    if (pe) {
      setError(pe.message);
      setLoading(false);
      return;
    }

    if ((profileData as { role?: string } | null)?.role !== "patient") {
      router.replace("/");
      return;
    }

    const nextProfile = profileData as PatientSettingsProfile;
    setProfile(nextProfile);
    const authEm = u?.email?.trim() ?? "";
    const profileEm = nextProfile.email?.trim() ?? "";
    setRecoveryEmail((authEm || profileEm).trim());
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const loginMethods = useMemo(
    () => patientLoginMethodsFromAuthAndProfile(authUser, profile?.whatsapp),
    [authUser, profile?.whatsapp],
  );

  const updateProfile = useCallback((patch: Partial<PatientSettingsProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const refreshAuthUser = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    setAuthUser(userData.user ?? null);
  }, []);

  return {
    loading,
    profile,
    authUser,
    error,
    recoveryEmail,
    setRecoveryEmail,
    loginMethods,
    load,
    updateProfile,
    refreshAuthUser,
  };
}

export type { PatientLoginMethods };

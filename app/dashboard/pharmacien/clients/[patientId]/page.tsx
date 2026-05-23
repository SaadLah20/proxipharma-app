"use client";

import { PharmacistPatientDetail } from "@/components/pharmacist/pharmacist-patient-detail";
import { use } from "react";

export default function PharmacienClientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  return <PharmacistPatientDetail patientId={patientId} />;
}

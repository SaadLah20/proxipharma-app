import { redirect } from "next/navigation";

export default function PatientConsultationsLibresPage() {
  redirect("/dashboard/demandes?parcours=consultations");
}

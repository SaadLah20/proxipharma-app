import { redirect } from "next/navigation";

export default function PharmacienConsultationsLibresPage() {
  redirect("/dashboard/pharmacien/demandes?parcours=consultations");
}

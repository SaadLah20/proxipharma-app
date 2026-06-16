import { redirect } from "next/navigation";

export default function PatientOrdonnancesPage() {
  redirect("/dashboard/demandes?parcours=ordonnances");
}

import { redirect } from "next/navigation";

export default function PharmacienOrdonnancesPage() {
  redirect("/dashboard/pharmacien/demandes?parcours=ordonnances");
}

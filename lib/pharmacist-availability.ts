/** Valeurs `availability_status_enum` (Postgres) + libellés UI */
export const PHARMACIST_AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "partially_available", label: "Disponible partiellement" },
  { value: "unavailable", label: "Indisponible" },
  { value: "to_order", label: "À commander" },
  { value: "market_shortage", label: "Rupture du marché" },
];

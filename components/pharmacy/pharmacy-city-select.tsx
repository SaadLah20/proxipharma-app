"use client";

import { useMemo } from "react";
import { buildPharmacyCitySelectOptions } from "@/lib/pharmacy-cities-morocco";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  required?: boolean;
  /** Valeur actuelle hors catalogue (ma fiche) — conservée comme option. */
  legacyValue?: string | null;
  placeholder?: string;
};

const baseClass =
  "w-full min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PharmacyCitySelect({
  value,
  onChange,
  id,
  className,
  required,
  legacyValue,
  placeholder = "Choisir une ville",
}: Props) {
  const options = useMemo(() => buildPharmacyCitySelectOptions(legacyValue ?? value), [legacyValue, value]);

  return (
    <select
      id={id}
      className={cn(baseClass, className)}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={`${opt.value}-${opt.legacy ? "legacy" : "catalog"}`} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

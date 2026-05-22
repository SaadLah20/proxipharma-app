"use client";

import type { PharmacyFieldMeta } from "@/lib/pharmacy-form-fields";

export function PharmacyFormField({
  meta,
  value,
  onChange,
}: {
  meta: PharmacyFieldMeta;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputClass =
    "mt-1.5 w-full min-h-11 rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <label className="block text-xs font-bold text-foreground">
      {meta.label}
      {meta.rows ? (
        <textarea
          rows={meta.rows}
          className={inputClass}
          value={value}
          maxLength={meta.maxLength}
          placeholder={meta.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={meta.type ?? "text"}
          inputMode={meta.inputMode}
          className={inputClass}
          value={value}
          maxLength={meta.maxLength}
          placeholder={meta.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <span className="mt-1 block text-[10px] font-normal leading-snug text-muted-foreground">{meta.hint}</span>
    </label>
  );
}

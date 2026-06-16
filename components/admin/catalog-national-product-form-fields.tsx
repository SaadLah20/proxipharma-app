"use client";

import { clsx } from "clsx";
import { catalogProductReportFieldLabelFr } from "@/lib/catalog-product-report-field-labels";
import type { CatalogProductReportFieldInput, CatalogProductReportFieldKey } from "@/lib/catalog-product-report-types";
import type { CatalogNationalProductFormValues } from "@/lib/catalog-national-product-form";
import { CATALOG_NATIONAL_PRODUCT_FORM_FIELD_ORDER } from "@/lib/catalog-national-product-form";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs sm:text-sm";

function ReportedFieldHint({ field }: { field: CatalogProductReportFieldInput }) {
  return (
    <div className="mt-1.5 space-y-1 rounded-md border border-amber-200/80 bg-amber-50/70 px-2.5 py-2 text-[11px] text-amber-950">
      {field.current_value ? (
        <p>
          <span className="font-semibold">Valeur catalogue : </span>
          <span className="line-through opacity-80">{field.current_value}</span>
        </p>
      ) : null}
      <p>
        <span className="font-semibold">Signalement pharmacien : </span>
        {field.suggested_value}
      </p>
    </div>
  );
}

function FieldInput({
  fieldKey,
  values,
  disabled,
  onChange,
}: {
  fieldKey: CatalogProductReportFieldKey;
  values: CatalogNationalProductFormValues;
  disabled?: boolean;
  onChange: (next: CatalogNationalProductFormValues) => void;
}) {
  const label = catalogProductReportFieldLabelFr(fieldKey);

  if (fieldKey === "product_type") {
    return (
      <label className="block min-w-0">
        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
        <select
          className={fieldClass}
          value={values.product_type}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...values,
              product_type: e.target.value as CatalogNationalProductFormValues["product_type"],
            })
          }
        >
          <option value="parapharmacie">Parapharmacie</option>
          <option value="medicament">Médicament</option>
        </select>
      </label>
    );
  }

  if (fieldKey === "short_description" || fieldKey === "full_description") {
    return (
      <label className="block min-w-0 md:col-span-2">
        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
        <textarea
          className={clsx(fieldClass, fieldKey === "full_description" ? "min-h-[88px]" : "min-h-[64px]")}
          value={values[fieldKey]}
          disabled={disabled}
          onChange={(e) => onChange({ ...values, [fieldKey]: e.target.value })}
        />
      </label>
    );
  }

  const value =
    fieldKey === "name"
      ? values.name
      : fieldKey === "price_pph"
        ? values.price_pph
        : fieldKey === "price_ppv"
          ? values.price_ppv
          : fieldKey === "brand"
            ? values.brand
            : fieldKey === "laboratory"
              ? values.laboratory
              : fieldKey === "form"
                ? values.form
                : fieldKey === "category"
                  ? values.category
                  : fieldKey === "subcategory"
                    ? values.subcategory
                    : fieldKey === "photo_url"
                      ? values.photo_url
                      : fieldKey === "usage"
                        ? values.usage
                        : values.advice;

  const spanClass = fieldKey === "name" || fieldKey === "photo_url" ? "md:col-span-2" : "";

  return (
    <label className={clsx("block min-w-0", spanClass)}>
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
        {label}
        {fieldKey === "price_pph" && values.product_type === "medicament" ? " (N/A médicament)" : null}
        {fieldKey === "price_ppv" && values.product_type === "parapharmacie" ? " (N/A parapharmacie)" : null}
      </span>
      <input
        className={fieldClass}
        value={value}
        disabled={
          disabled ||
          (fieldKey === "price_pph" && values.product_type === "medicament") ||
          (fieldKey === "price_ppv" && values.product_type === "parapharmacie")
        }
        onChange={(e) => onChange({ ...values, [fieldKey]: e.target.value })}
      />
    </label>
  );
}

export function CatalogNationalProductFormFields({
  values,
  onChange,
  reportedFields,
  reportedFieldKeys,
  disabled,
}: {
  values: CatalogNationalProductFormValues;
  onChange: (next: CatalogNationalProductFormValues) => void;
  reportedFields: CatalogProductReportFieldInput[];
  reportedFieldKeys: CatalogProductReportFieldKey[];
  disabled?: boolean;
}) {
  const reportedSet = new Set(reportedFieldKeys);
  const reportedMap = new Map(reportedFields.map((f) => [f.field_key, f]));
  const reportedKeysOrdered = reportedFieldKeys.filter((k) => reportedMap.has(k));
  const otherKeys = CATALOG_NATIONAL_PRODUCT_FORM_FIELD_ORDER.filter((k) => !reportedSet.has(k));

  return (
    <div className="space-y-4">
      {reportedKeysOrdered.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/20 p-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Champs signalés</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {reportedKeysOrdered.map((key) => {
              const field = reportedMap.get(key)!;
              return (
                <div
                  key={key}
                  className={clsx(
                    "min-w-0 rounded-lg border border-amber-300/60 bg-white/80 p-2.5",
                    key === "name" || key === "photo_url" || key === "short_description" || key === "full_description"
                      ? "sm:col-span-2"
                      : ""
                  )}
                >
                  <FieldInput fieldKey={key} values={values} disabled={disabled} onChange={onChange} />
                  <ReportedFieldHint field={field} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Autres champs produit</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {otherKeys.map((key) => (
            <FieldInput key={key} fieldKey={key} values={values} disabled={disabled} onChange={onChange} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function PharmacistReportedFieldReviewCard({ field }: { field: CatalogProductReportFieldInput }) {
  const hasApplied =
    field.applied_value != null &&
    field.applied_value.trim() !== "" &&
    field.applied_value.trim() !== (field.current_value ?? "").trim();

  return (
    <div className="rounded-lg border border-border/80 bg-card px-3 py-2.5 text-xs">
      <p className="font-semibold text-foreground">{catalogProductReportFieldLabelFr(field.field_key)}</p>
      <dl className="mt-2 space-y-1.5">
        {field.current_value ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ancienne valeur</dt>
            <dd className="text-muted-foreground">{field.current_value}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Votre signalement</dt>
          <dd className="font-medium text-foreground">{field.suggested_value}</dd>
        </div>
        {hasApplied ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Nouvelle valeur</dt>
            <dd className="font-semibold text-emerald-900">{field.applied_value}</dd>
          </div>
        ) : field.applied_value ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Valeur catalogue</dt>
            <dd className="text-foreground">{field.applied_value}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

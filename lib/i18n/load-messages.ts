import type { AppLocale } from "@/lib/i18n/config";

const loaders: Record<AppLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  fr: () => import("@/messages/fr"),
  ar: () => import("@/messages/ar"),
};

export async function loadMessages(locale: AppLocale): Promise<Record<string, unknown>> {
  const mod = await loaders[locale]();
  return mod.default;
}

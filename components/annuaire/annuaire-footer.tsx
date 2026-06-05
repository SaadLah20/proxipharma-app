"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function AnnuaireFooter() {
  const t = useTranslations("annuaire");

  const footerLinks = [
    { labelKey: "footer.about" as const, href: "#" },
    { labelKey: "footer.contact" as const, href: "#" },
    { labelKey: "footer.partners" as const, href: "#" },
    { labelKey: "footer.privacy" as const, href: "#" },
    { labelKey: "footer.dataProcessing" as const, href: "#" },
    { labelKey: "footer.pharmacistSignup" as const, href: "/auth?redirect=/dashboard/pharmacien" },
  ];

  return (
    <footer className="mt-10 border-t border-border/80 bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
        <p className="text-center text-sm font-semibold text-foreground">ProxiPharma</p>
        <p className="mt-1 text-center text-xs text-muted-foreground">{t("footer.tagline")}</p>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2">
          {footerLinks.map((link) => (
            <li key={link.labelKey}>
              <Link
                href={link.href}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={(e) => {
                  if (link.href === "#") e.preventDefault();
                }}
              >
                {t(link.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-[10px] text-muted-foreground/80">
          {t("footer.legalPending", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}

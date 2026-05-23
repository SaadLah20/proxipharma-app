"use client";

import Link from "next/link";

const FOOTER_LINKS = [
  { label: "À propos", href: "#" },
  { label: "Contactez-nous", href: "#" },
  { label: "Nos partenaires", href: "#" },
  { label: "Politique de confidentialité", href: "#" },
  { label: "Traitement des données personnelles", href: "#" },
  { label: "Devenir membre (pharmacien)", href: "/auth?redirect=/dashboard/pharmacien" },
] as const;

export function AnnuaireFooter() {
  return (
    <footer className="mt-10 border-t border-border/80 bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5">
        <p className="text-center text-sm font-semibold text-foreground">ProxiPharma</p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Annuaire interactif des pharmacies au Maroc
        </p>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={(e) => {
                  if (link.href === "#") e.preventDefault();
                }}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-[10px] text-muted-foreground/80">
          © {new Date().getFullYear()} ProxiPharma — pages légales à venir
        </p>
      </div>
    </footer>
  );
}

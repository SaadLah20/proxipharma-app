import type { StickyFooterTone } from "@/lib/platform-sticky-footer";

type ToneStyle = {
  banner: string;
  shell: string;
  panelEditing: string;
  panelLabel: string;
};

const TONE_STYLES: Record<StickyFooterTone, ToneStyle> = {
  sky: {
    banner: "border-sky-300/80 bg-sky-50/90 text-sky-950 ring-1 ring-sky-200/50",
    shell: "ring-2 ring-sky-200/55 bg-sky-50/12",
    panelEditing: "border-sky-400/85 shadow-md ring-1 ring-sky-200/40",
    panelLabel: "text-sky-800/90",
  },
  amber: {
    banner: "border-amber-300/80 bg-amber-50/90 text-amber-950 ring-1 ring-amber-200/50",
    shell: "ring-2 ring-amber-200/55 bg-amber-50/12",
    panelEditing: "border-amber-400/85 shadow-md ring-1 ring-amber-200/40",
    panelLabel: "text-amber-900/90",
  },
  violet: {
    banner: "border-violet-300/80 bg-violet-50/90 text-violet-950 ring-1 ring-violet-200/50",
    shell: "ring-2 ring-violet-200/55 bg-violet-50/12",
    panelEditing: "border-violet-400/85 shadow-md ring-1 ring-violet-200/40",
    panelLabel: "text-violet-900/90",
  },
  slate: {
    banner: "border-slate-300/80 bg-slate-50/90 text-slate-950 ring-1 ring-slate-200/50",
    shell: "ring-2 ring-slate-200/55 bg-slate-50/12",
    panelEditing: "border-slate-400/85 shadow-md ring-1 ring-slate-200/40",
    panelLabel: "text-slate-800/90",
  },
  emerald: {
    banner: "border-emerald-300/80 bg-emerald-50/90 text-emerald-950 ring-1 ring-emerald-200/50",
    shell: "ring-2 ring-emerald-200/55 bg-emerald-50/12",
    panelEditing: "border-emerald-400/85 shadow-md ring-1 ring-emerald-200/40",
    panelLabel: "text-emerald-900/90",
  },
  neutral: {
    banner: "border-border/80 bg-muted/30 text-foreground ring-1 ring-border/50",
    shell: "ring-2 ring-border/40 bg-muted/10",
    panelEditing: "border-border shadow-md ring-1 ring-border/30",
    panelLabel: "text-muted-foreground",
  },
};

export function dossierEditModeBannerClass(tone: StickyFooterTone): string {
  return TONE_STYLES[tone].banner;
}

export function dossierEditModeShellClass(tone: StickyFooterTone): string {
  return TONE_STYLES[tone].shell;
}

export function dossierEditModePanelClass(tone: StickyFooterTone): string {
  return TONE_STYLES[tone].panelEditing;
}

export function dossierEditModePanelLabelClass(tone: StickyFooterTone): string {
  return TONE_STYLES[tone].panelLabel;
}

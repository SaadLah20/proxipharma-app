/** Compteur global — évite un `overflow: hidden` bloqué après plusieurs modales. */
let lockCount = 0;
let savedOverflow: string | null = null;

/** Bloque le scroll de la page (fond modale). Retourner la fonction de release au cleanup. */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.modalOpen = "true";
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow ?? "";
      delete document.body.dataset.modalOpen;
      savedOverflow = null;
    }
  };
}

/** Filet de sécurité (navigation, erreur React) — ne pas appeler en usage normal. */
export function resetBodyScrollLock(): void {
  if (typeof document === "undefined") return;
  lockCount = 0;
  savedOverflow = null;
  document.body.style.overflow = "";
  delete document.body.dataset.modalOpen;
}

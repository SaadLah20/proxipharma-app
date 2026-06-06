/**
 * Préparation photos patient (ordonnance, consultation) : compresser d’abord,
 * limiter la taille après compression (pas sur l’original téléphone).
 */

/** Garde-fou anti-abus sur le fichier brut (avant compression). */
export const PATIENT_REQUEST_PHOTO_RAW_MAX_BYTES = 30 * 1024 * 1024;

/** Taille max du WebP envoyé à Supabase (après redimensionnement). */
export const PATIENT_REQUEST_PHOTO_COMPRESSED_MAX_BYTES = 4 * 1024 * 1024;

const RAW_MAX_MB = Math.round(PATIENT_REQUEST_PHOTO_RAW_MAX_BYTES / (1024 * 1024));
const COMPRESSED_MAX_MB = Math.round(PATIENT_REQUEST_PHOTO_COMPRESSED_MAX_BYTES / (1024 * 1024));

function isAcceptedPatientPhotoFile(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t.startsWith("image/")) return true;
  // iOS / Android : parfois type vide ou heic non standard
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export type PreparePatientRequestPhotoResult =
  | { ok: true; blob: Blob }
  | { ok: false; error: string };

/**
 * Compresse puis valide. Ne rejette pas une photo « lourde » tant qu’elle
 * peut être réduite sous la limite d’upload.
 */
export async function preparePatientRequestPhoto(
  file: File,
  compress: (file: File) => Promise<Blob>
): Promise<PreparePatientRequestPhotoResult> {
  if (!isAcceptedPatientPhotoFile(file)) {
    return { ok: false, error: "Formats acceptés : JPEG, PNG, WebP ou photo téléphone (HEIC)." };
  }

  if (file.size > PATIENT_REQUEST_PHOTO_RAW_MAX_BYTES) {
    return {
      ok: false,
      error: `Photo trop volumineuse (max. ${RAW_MAX_MB} Mo avant traitement). Réessayez une capture plus légère ou recadrez.`,
    };
  }

  let blob: Blob;
  try {
    blob = await compress(file);
  } catch {
    return {
      ok: false,
      error: "Impossible de lire cette photo. Essayez une autre image ou prenez une nouvelle photo.",
    };
  }

  if (blob.size > PATIENT_REQUEST_PHOTO_COMPRESSED_MAX_BYTES) {
    return {
      ok: false,
      error: `Photo illisible ou trop détaillée même après compression (max. ${COMPRESSED_MAX_MB} Mo). Recadrez ou rapprochez-vous de l’ordonnance.`,
    };
  }

  return { ok: true, blob };
}

export function patientRequestPhotoTooLargeAfterCompressMessage(): string {
  return `Photo trop lourde après compression (max. ${COMPRESSED_MAX_MB} Mo).`;
}

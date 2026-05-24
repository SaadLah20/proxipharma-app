/** Mot de passe provisoire lisible (pilote admin → pharmacien). */
export function generateProvisionalPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i]! % chars.length];
  }
  return out;
}

export function validateProvisionalPassword(password: string): string | null {
  const p = password.trim();
  if (p.length < 6) return "Le mot de passe provisoire doit contenir au moins 6 caractères.";
  if (p.length > 72) return "Mot de passe trop long (72 caractères max).";
  return null;
}

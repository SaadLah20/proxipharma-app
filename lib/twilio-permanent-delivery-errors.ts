/** Codes Twilio SMS : ne pas retenter (facturation à chaque appel). */
const TWILIO_SMS_PERMANENT_ERROR_CODES = new Set([
  21211, 21214, 21217, 21219, 21408, 21601, 21602, 21604, 21606, 21607, 21608, 21610, 21611, 21612,
  21614, 30007, 30032, 30034, 30035,
]);

/** Codes Twilio WhatsApp : numéro invalide / pas WhatsApp / hors fenêtre 24 h — ne pas retenter. */
const TWILIO_WHATSAPP_PERMANENT_ERROR_CODES = new Set([
  21211,
  21608,
  63003,
  63007,
  63016,
  63024,
  63032,
  63112,
]);

function twilioErrorCodeInMessage(errorMessage: string, codes: Set<number>): boolean {
  const raw = errorMessage.trim();
  try {
    const j = JSON.parse(raw) as { code?: unknown };
    if (typeof j.code === "number" && codes.has(j.code)) return true;
  } catch {
    /* corps Twilio parfois embarqué dans notre message */
  }
  const quoted = raw.match(/"code"\s*:\s*(\d+)/);
  if (quoted && codes.has(Number(quoted[1]))) return true;
  const errorCode = raw.match(/error_code\s+(\d+)/i);
  if (errorCode && codes.has(Number(errorCode[1]))) return true;
  return false;
}

export function twilioSmsErrorLooksPermanent(errorMessage: string): boolean {
  return twilioErrorCodeInMessage(errorMessage, TWILIO_SMS_PERMANENT_ERROR_CODES);
}

export function twilioWhatsAppErrorLooksPermanent(errorMessage: string): boolean {
  return (
    twilioErrorCodeInMessage(errorMessage, TWILIO_WHATSAPP_PERMANENT_ERROR_CODES) ||
    twilioSmsErrorLooksPermanent(errorMessage)
  );
}

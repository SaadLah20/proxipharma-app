/** Token SMS = UUID demande sans tirets (32 hex) → lookup exact en base. */
export const SMS_REQUEST_TOKEN_HEX_LEN = 32;

const TOKEN_32_RE = /^[0-9a-f]{32}$/i;

/** UUID compact pour `/r/{token}` */
export function smsRequestShortToken(requestId: string): string {
  return requestId.replace(/-/g, "").toLowerCase();
}

export function isValidSmsRequestShortToken(token: string): boolean {
  return TOKEN_32_RE.test(token.trim());
}

/** Reconstruit l’UUID canonique depuis le token SMS. */
export function requestIdFromSmsToken(token: string): string | null {
  const h = token.trim().toLowerCase();
  if (!TOKEN_32_RE.test(h)) return null;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function buildSmsRequestShortUrl(origin: string, requestId: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/r/${smsRequestShortToken(requestId)}`;
}

/**
 * Pilote SMS : lien court dans les notifs responded/treated.
 * Désactiver (unset / `0` / `false`) = comportement prod actuel sans URL.
 */
export function isSmsRequestLinkEnabled(): boolean {
  const v = (process.env.SMS_INCLUDE_REQUEST_LINK ?? "").trim().toLowerCase();
  if (!v || v === "0" || v === "false" || v === "no" || v === "off") return false;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function appendSmsRequestLinkIfEnabled(args: {
  text: string;
  requestOrigin: string;
  requestId: string;
  eventType: string;
}): string {
  if (!isSmsRequestLinkEnabled()) return args.text;
  if (
    args.eventType !== "request_status:responded" &&
    args.eventType !== "request_status:treated"
  ) {
    return args.text;
  }
  const url = buildSmsRequestShortUrl(args.requestOrigin, args.requestId);
  const base = args.text.replace(/\.\s*$/, "").trimEnd();
  return `${base} ${url}`;
}

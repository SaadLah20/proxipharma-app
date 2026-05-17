/** Longueur du token court dans `/r/{token}` (préfixe UUID sans tirets). */
export const SMS_REQUEST_SHORT_TOKEN_LEN = 8;

const TOKEN_RE = /^[0-9a-f]{8}$/i;

/** Préfixe stable pour lookup `requests.id::text ilike '{token}%'` */
export function smsRequestShortToken(requestId: string): string {
  return requestId.replace(/-/g, "").slice(0, SMS_REQUEST_SHORT_TOKEN_LEN).toLowerCase();
}

export function isValidSmsRequestShortToken(token: string): boolean {
  return TOKEN_RE.test(token.trim());
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

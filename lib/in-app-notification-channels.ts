/** Alertes conversation dossier — affichées dans l’onglet Messages, pas Notifications. */
export function isConversationNotificationEvent(eventType: string | null | undefined): boolean {
  const t = (eventType ?? "").toLowerCase();
  return t.includes("conversation") || t.startsWith("request_conversation:");
}

export function isAlertNotificationEvent(eventType: string | null | undefined): boolean {
  return !isConversationNotificationEvent(eventType);
}

/** Aligné sur la BDD (CHECK `client_comment` ≤ 500). */
export const PATIENT_PRODUCT_LINE_COMMENT_MAX = 500;

/** Messages du fil conversation (`request_comments`, migration `20260517_001`). */
export const REQUEST_CONVERSATION_MESSAGE_MAX = 1200;

/** @deprecated Préférer `REQUEST_CONVERSATION_MESSAGE_MAX` (conversation). */
export const PATIENT_GENERAL_NOTE_MAX = REQUEST_CONVERSATION_MESSAGE_MAX;

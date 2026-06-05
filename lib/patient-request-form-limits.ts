/** Aligné sur la BDD (CHECK `client_comment` ≤ 500). */
export const PATIENT_PRODUCT_LINE_COMMENT_MAX = 500;

/** Consultation libre : paragraphe initial / édition patient. */
export const CONSULTATION_TEXT_MIN = 10;
export const CONSULTATION_TEXT_MAX = 1500;

/** Messages du fil conversation (`request_comments`, migration `20260517_001`). */
export const REQUEST_CONVERSATION_MESSAGE_MAX = 1200;

/** Durée max message vocal conversation (aligné migration `20260706_001`). */
export const REQUEST_CONVERSATION_AUDIO_MAX_SECONDS = 30;

/** Plafond taille blob vocal (~30 s opus/webm). */
export const REQUEST_CONVERSATION_AUDIO_MAX_BYTES = 768_000;

/** @deprecated Préférer `REQUEST_CONVERSATION_MESSAGE_MAX` (conversation). */
export const PATIENT_GENERAL_NOTE_MAX = REQUEST_CONVERSATION_MESSAGE_MAX;

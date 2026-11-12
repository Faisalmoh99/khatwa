/**
 * The fixed patient reports the AI classifier may return (shared by the Netlify function and the app).
 * The AI never sets a level: a report goes through the same path as the patient's own report.
 *   red:    wound, blister, swelling, fever → red-flag path (same as the templates)
 *   yellow: redness, new_pain → the patient is asked to confirm in the quick check
 */
export const AI_CODES = ['wound', 'blister', 'new_pain', 'redness', 'swelling', 'fever', 'none'] as const;
export type AiCode = (typeof AI_CODES)[number];

export const AI_RED: Partial<Record<AiCode, string>> = {
  wound: 'جرح أو قرحة',
  blister: 'فقاعة',
  swelling: 'تورم',
  fever: 'حمى أو قشعريرة',
};
export const AI_YELLOW: Partial<Record<AiCode, string>> = {
  redness: 'احمرار',
  new_pain: 'ألم جديد',
};

export const MAX_TEXT = 300;
export const DAILY_LIMIT = 30;
export const AI_MODEL = 'claude-haiku-5-5';

/**
 * Merging the AI report with the fixed templates. Rule: take the more serious one.
 * The AI can only add a patient report; it never lowers anything the templates found.
 */
import { AI_RED, AI_YELLOW, type AiCode } from './aiCodes';
import { redFlags } from './understand';

/** Call the model only for free text with no clear red flag already found by the templates. */
export function needsAi(text: string): boolean {
  return text.trim().length >= 2 && redFlags(text).length === 0;
}

export interface Combined {
  /** Red flags to add to the template reply (red path, same as the templates). */
  extraFlags: { why: string }[];
  /** The AI heard redness / new pain: ask the patient to confirm in the quick check. */
  confirmInQuickCheck: string | null;
  /** Final severity of what the patient said. */
  severity: 'red' | 'yellow' | 'none';
}

export function combine(text: string, ai: AiCode | null): Combined {
  const local = redFlags(text);
  if (local.length) return { extraFlags: [], confirmInQuickCheck: null, severity: 'red' };
  const red = ai ? AI_RED[ai] : undefined;
  if (red) return { extraFlags: [{ why: red }], confirmInQuickCheck: null, severity: 'red' };
  const yellow = ai ? AI_YELLOW[ai] : undefined;
  if (yellow) return { extraFlags: [], confirmInQuickCheck: yellow, severity: 'yellow' };
  return { extraFlags: [], confirmInQuickCheck: null, severity: 'none' };
}

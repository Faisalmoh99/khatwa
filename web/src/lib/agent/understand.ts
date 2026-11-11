/**
 * Understanding free text from the patient (ported from the prototype's Agent).
 * Keyword rules only. A false alarm costs one extra call; a miss costs much more,
 * so red-flag matching is deliberately generous, with negation handling ("ما فيه جرح").
 */

/** Arabic normalisation: no diacritics/tatweel, unified alef/yaa/taa marbuta, no punctuation. */
export const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[؟?!.,،؛]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Red flags: each maps to a fixed report code (shared with the AI classifier in phase 5). */
export type ReportCode =
  | 'wound'
  | 'blister'
  | 'new_pain'
  | 'redness'
  | 'swelling'
  | 'fever'
  | 'discharge'
  | 'odor'
  | 'color'
  | 'none';

export const FLAGS: { code: ReportCode; why: string; re: RegExp }[] = [
  {
    code: 'discharge',
    why: 'خروج سائل أو دم',
    re: /(سايل|سائل|صديد|قيح|يسيل|يطلع منه|نزيف|ينزف|(^| )دم( |$))/,
  },
  { code: 'odor', why: 'رائحة كريهة', re: /(رايحه|ريحه|رائحه)/ },
  { code: 'wound', why: 'جرح أو قرحة', re: /(جرح|قرحه|تقرح|تسلخ|شق عميق|مسمار|انجرحت)/ },
  { code: 'blister', why: 'فقاعة', re: /(فقاعه|فقاقيع|بثره|نفطه)/ },
  { code: 'swelling', why: 'تورم', re: /(تورم|متورم|منتفخ|انتفاخ|(^| )ورم( |$))/ },
  {
    code: 'color',
    why: 'تغيّر لون القدم',
    re: /(اسود|اسوداد|ازرق|زرقه|لون غامق|تغير لون|تغير في لون|لونها تغير)/,
  },
  { code: 'fever', why: 'حمى أو قشعريرة', re: /(حمي|سخونه|قشعريره|ارتفاع حراره|حراره عاليه|محموم)/ },
  { code: 'new_pain', why: 'ألم شديد', re: /(الم شديد|وجع شديد|يوجعني كثير|ما اقدر امشي|ما اقدر اوقف)/ },
];

/** Negation right before the match: "ما فيه جرح" does not escalate. */
const NEG = /(ما فيه|مافيه|ما فيها|ما في|مافي|ما عندي|ماعندي|ما لاحظت|ما شفت|بدون|لا يوجد|ولا)\s+(\S+\s+)?$/;

export function redFlags(text: string): { code: ReportCode; why: string }[] {
  const t = norm(text);
  const out: { code: ReportCode; why: string }[] = [];
  for (const f of FLAGS) {
    const m = t.match(f.re);
    if (!m || m.index === undefined) continue;
    const before = t.slice(0, m.index + (m[0].startsWith(' ') ? 1 : 0));
    if (NEG.test(before)) continue;
    out.push({ code: f.code, why: f.why });
  }
  return out;
}

/**
 * Softer reports the templates recognise themselves (yellow, never red): the patient is asked to
 * confirm in the quick check, same as the AI path. Negation applies ("ما فيه احمرار").
 */
export const SOFT: { code: ReportCode; why: string; re: RegExp }[] = [
  { code: 'redness', why: 'احمرار', re: /(احمرار|احمرت|محمر|حمرا|(^| )حمره( |$))/ },
];

export function softReports(text: string): { code: ReportCode; why: string }[] {
  const t = norm(text);
  return SOFT.filter((f) => {
    const m = t.match(f.re);
    if (!m || m.index === undefined) return false;
    return !NEG.test(t.slice(0, m.index + (m[0].startsWith(' ') ? 1 : 0)));
  }).map(({ code, why }) => ({ code, why }));
}

/** Medical questions the assistant must not answer (diagnosis, treatment, medicine). */
export const MEDICAL =
  /(هل (هذا|هذي|ده|الجرح)? ?(خطير|خطر)|وش (المرض|المشكله|اخذ)|ايش (المرض|المشكله)|دواء|ادويه|مضاد حيوي|مرهم|كريم|علاج|اتعالج|تشخيص|اشخص|حبوب)/;

export type Intent =
  | 'stop'
  | 'travel'
  | 'bandage'
  | 'hospital'
  | 'forgot'
  | 'tired'
  | 'device'
  | 'photo'
  | 'check'
  | 'why'
  | 'now'
  | 'care'
  | 'doc'
  | 'ok';

const INTENTS: [Intent, RegExp][] = [
  ['why', /(ليش|لماذا|وش سبب|ايش سبب).*(صفر|برتقال|حمر|خضر|لون|قدمي|قراءت|مستوا)/],
  ['now', /(وش اسوي|ايش اسوي|ماذا افعل|وش المطلوب)/],
  ['care', /(اعتني|العنايه|عنايه|انظف|اغسل|نصايح|نصيحه)/],
  ['doc', /(متي (اراجع|اروح|ازور)|اراجع الطبيب|اروح المستشفي)/],
  // "Stop the alerts": never switched off from chat; pointed to travel mode in settings.
  ['stop', /(وقف|اوقف|ايقاف|طفي|اطفي|بطل|الغ|لا ترسل|ما ابي).*(تنبيه|اشعار|تذكير|رسايل)/],
  ['travel', /(سفر|مسافر|سافرت|رحله|برا البلد)/],
  ['bandage', /(ضماد|جبيره|جبس|مغطي|لفاف)/],
  ['hospital', /(مستشفي|تنويم|منوم|عمليه|اتنوم)/],
  ['forgot', /(نسيت|نسيان|ما تذكرت|ما انتبهت)/],
  ['tired', /(تعبان|مرهق|ما عندي طاقه|مشغول|ما عندي وقت|زحمه|كسلان)/],
  ['device', /(ما تشتغل|عطلان|خربان|مشكله (في|ب)?(الجهاز|السجاده)|السجاده (ما|فيها)|لا تعمل|ما تقيس)/],
  ['photo', /(صور|صوره|الصوره|اصور)/],
  ['check', /(فحص|ابدا)/],
  ['ok', /^(فهمت|تمام|حاضر|اوكي|ok|ابشر|ان شاء الله|شكرا|الله يعطيك العافيه|طيب)/],
];

export function intent(text: string): Intent | null {
  const t = norm(text);
  for (const [id, re] of INTENTS) if (re.test(t)) return id;
  return null;
}

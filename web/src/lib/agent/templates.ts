/**
 * Fixed conversation templates (ported from the prototype's Agent.opener / Agent.reply).
 * The assistant escalates, never de-escalates, never diagnoses, never prescribes.
 * Every reply text below is written in advance. Free text is only *classified* (understand.ts);
 * the patient always gets one of these templates back.
 */
import type { NewEvent } from '@/data/types';
import { consecutiveDays, dayWord, ltr } from '../format';
import type { FinalLevel, Mode } from '../level';
import type { Status } from '../rules/rules';
import { intent, type Intent, MEDICAL, norm, redFlags, softReports } from './understand';

export type QuickReplyId =
  | 'fine'
  | 'note'
  | 'forgot'
  | 'travel'
  | 'bandage'
  | 'hospital'
  | 'tired'
  | 'check'
  | 'ok'
  | 'wound'
  | 'photo'
  | 'remind'
  | 'no'
  | 'device'
  | 'why'
  | 'now'
  | 'care'
  | 'doc'
  | 'mode:travel'
  | 'mode:bandage'
  | 'mode:hospital'
  | 'mode:normal'
  | 'settings:modes';

export const QR: Record<QuickReplyId, string> = {
  fine: 'كل شي تمام',
  note: 'عندي ملاحظة',
  forgot: 'نسيت',
  travel: 'مسافر',
  bandage: 'عندي ضماد',
  hospital: 'أنا في المستشفى',
  tired: 'تعبان اليوم',
  check: 'ابدأ الفحص السريع',
  ok: 'فهمت',
  wound: 'عندي جرح أو سائل',
  photo: 'صوّر المكان',
  remind: 'ذكّرني الساعة 8 مساءً',
  no: 'لا',
  device: 'السجادة فيها مشكلة',
  why: 'ليش هذا المستوى؟',
  now: 'وش أسوي الحين؟',
  care: 'كيف أعتني بقدمي؟',
  doc: 'متى أراجع الطبيب؟',
  'mode:travel': 'فعّل وضع السفر',
  'mode:bandage': 'فعّل وضع الضماد',
  'mode:hospital': 'أوقف التنبيهات',
  'mode:normal': 'رجّعني للوضع العادي',
  'settings:modes': 'افتح وضع السفر في الإعدادات',
};

export interface BotMsg {
  who: 'bot';
  text: string;
  replies: QuickReplyId[];
  /** 'urgent' = fixed red-flag text. */
  tone?: 'urgent' | 'normal';
}
export interface UserMsg {
  who: 'user';
  text: string;
}
export type ChatMsg = BotMsg | UserMsg;

export type Effect =
  { type: 'event'; event: NewEvent } | { type: 'goto'; to: string } | { type: 'reminder'; time: string };

export interface ChatContext {
  level: FinalLevel;
  /** First reason in plain Arabic. */
  reason: string;
  thermal: Status | null;
  site: string;
  foot: string;
  dT: number;
  streak: number;
  missed: number;
  mode: Mode;
  todayDone: boolean;
  quickDone: boolean;
  familyConsent: boolean;
  dayKey: string;
}

export const FIXED_RED = (fam: boolean) =>
  `هذي علامة نحتاج العيادة تشوفها اليوم. أبلغنا العيادة${fam ? ' والعائلة' : ''} بشكل عاجل. لا تنتظر: إذا عندك حمى أو ألم شديد أو تغيّر في لون القدم، روح لأقرب طوارئ.`;
export const FIXED_MED = 'ما أقدر أحكم على حالتك ولا أوصي بعلاج أو دواء. أرسلت سؤالك للممرضة وبترد عليك.';

const bot = (text: string, replies: QuickReplyId[] = [], tone: BotMsg['tone'] = 'normal'): BotMsg => ({
  who: 'bot',
  text,
  replies,
  tone,
});
const deg = (v: number) => ltr(Math.abs(v).toFixed(1) + '°');

/** The assistant opens the day's conversation, based on today's state. */
export function opener(c: ChatContext): BotMsg {
  const fam = c.familyConsent;
  if (c.level === 'red')
    return bot(
      `مستواك اليوم أحمر: ${c.reason}. نبي منك تراجع الطبيب خلال 24 ساعة، وأبلغنا العيادة${fam ? ' وعائلتك' : ''}. ما أقدر أشخّص، لكن لا تأجّل الموعد.`,
      ['ok', 'photo', 'now'],
    );
  if (c.level === 'paused') {
    if (c.mode === 'hospital')
      return bot('سلامتك. أوقفنا التذكيرات والتنبيهات طول فترة التنويم. قل لي لما تطلع.', ['mode:normal']);
    if (c.mode === 'bandage')
      return bot(
        'وضع الضماد شغّال: المقارنة بين القدمين متوقفة لأن الضماد يغيّر الحرارة. افحص قدمك بالنظر كل يوم، وصوّرها لو تقدر.',
        ['check', 'mode:normal'],
      );
    return bot('وضع السفر شغّال: السجادة ما تنتظرك. سوّ الفحص السريع اليوم، وقل لي لما ترجع.', [
      'check',
      'mode:normal',
    ]);
  }
  if (c.thermal === 'alert')
    return bot(
      `عندنا نقطة ساخنة مستمرة عند ${c.site} في القدم ${c.foot}، الفرق ${deg(c.dT)} ${consecutiveDays(c.streak)}. خفّف المشي عليها اليوم${fam ? '، وأبلغنا عائلتك' : ''}. تقدر تصوّر المكان عشان تشوفه العيادة؟`,
      ['ok', 'photo', 'wound'],
    );
  if (c.level === 'yellow' && c.thermal !== 'watch')
    return bot(
      `ظهرت إشارة وحدة غير عادية اليوم: ${c.reason}. إشارة وحدة ما تكفي لتنبيه. أعد الفحص بكرة، وإذا لاحظت جرح أو ألم جديد اكتب لي.`,
      ['fine', 'wound'],
    );
  if (c.thermal === 'watch')
    return bot(
      `ظهر اليوم فرق عند ${c.site} في القدم ${c.foot} (${deg(c.dT)})، ولمرة وحدة بس، وهذا ما يكفي لتنبيه. قِس بكرة بنفس الطريقة، وإذا لاحظت جرح أو احمرار أو ألم جديد اكتب لي.`,
      ['fine', 'wound', 'why'],
    );
  if (c.thermal === 'normal')
    return bot(
      'السلام عليكم. قياس اليوم وصل، والفرق بين القدمين أقل من الحد في كل النقاط. عندك شي تبي تسأل عنه؟',
      ['fine', 'note', 'care'],
    );
  if (c.thermal === 'invalid')
    return bot(
      'السجادة ما تأكدت من وقوفك على القدمين، فما سجّلنا القراءة. قف بالقدمين معًا واثبت لين يقول لك الجوال «تم»، وأعد القياس.',
      ['device', 'check'],
    );
  if (c.quickDone)
    return bot('وصلنا فحصك السريع بدل القياس، شكرًا. نرجع للقياس الكامل أول ما تقدر.', ['fine']);
  if (c.missed >= 3)
    return bot(
      `صار لك ${dayWord(c.missed)} بدون قياس، ووصل إشعار للعيادة. أهم شي نطمّن عليك، ابدأ الفحص السريع الحين.`,
      ['check', 'travel', 'hospital', 'device'],
    );
  if (c.missed === 2)
    return bot(
      `صار لك يومين بدون قياس${fam ? '، وأرسلنا تذكير لعائلتك' : ''}. وش اللي صار؟ ولو تعبان ابدأ بالفحص السريع.`,
      ['forgot', 'travel', 'tired', 'hospital', 'check'],
    );
  if (c.missed === 1)
    return bot(
      'ما وصلنا قياس اليوم. خير؟ إذا مشغول أو مسافر ما عليك، نسوّي فحص سريع بثلاث نقرات بدل القياس.',
      ['forgot', 'travel', 'bandage', 'hospital', 'check'],
    );
  return bot('السلام عليكم. ما قست اليوم بعد. قف على السجادة قبل الوضوء، أو سوّ الفحص السريع إذا ما قدرت.', [
    'check',
    'travel',
    'care',
  ]);
}

/** Template answers to the four common questions. */
export function answer(id: 'why' | 'now' | 'care' | 'doc', c: ChatContext): string {
  if (id === 'why') {
    if (c.level === 'paused')
      return 'لأنك في وضع خاص (سفر أو ضماد أو تنويم)، فالمقارنة والتنبيهات متوقفة مؤقتًا.';
    if (c.level === 'none')
      return c.thermal === 'invalid'
        ? 'لأن السجادة ما تأكدت من وقوفك على القدمين معًا، فتجاهلت القراءة بدل ما تبني عليها مقارنة غلط.'
        : 'لأنه ما وصلنا قياس اليوم. تقدر تقيس من السجادة أو تسوي الفحص السريع.';
    const t: Record<string, string> = {
      green: `لأن الفرق بين القدمين اليوم أقل من ${ltr('2.2°')} في كل النقاط.`,
      yellow: `لأن ظهرت إشارة وحدة غير عادية اليوم: ${c.reason}. إشارة وحدة ليوم واحد ما تكفي لتنبيه، لكن أعد الفحص بكرة.`,
      orange: `لأن ${c.reason}. يعني نقطة تحتاج انتباه، فطلبنا صورة للمكان عشان تشوفها العيادة.`,
      red: `لأن ${c.reason}. هذا يستدعي مراجعة الطبيب خلال 24 ساعة، وأبلغنا العيادة.`,
    };
    return `${t[c.level] ?? ''} هذا مو تشخيص، أنا ما أشخّص.`;
  }
  if (id === 'now') {
    const t: Record<string, string> = {
      green: 'استمر على روتينك: افحص قدميك، وقِس بكرة قبل الوضوء.',
      yellow: 'ارتح بقدميك، وخفّف المشي الطويل، وأعد الفحص بكرة. إذا ظهر جرح أو ألم جديد اكتب لي.',
      orange:
        'خفّف المشي على المكان، وصوّره من شاشة «التصوير». لا تدلّك المنطقة ولا تحط عليها شي بدون توجيه الممرضة.',
      red: 'تواصل مع العيادة أو احجز موعد اليوم، ولا تنتظر. إذا عندك حمى أو ألم شديد أو سائل من جرح، روح لأقرب طوارئ.',
    };
    return t[c.level] ?? 'ابدأ بالفحص من السجادة، أو الفحص السريع إذا ما قدرت.';
  }
  if (id === 'care')
    return 'نشّف بين أصابعك بعد الوضوء، ولا تمشِ حافي، وافحص الحذاء من داخل قبل ما تلبسه، ورطّب جلد القدم بس مو بين الأصابع. التفاصيل في «نصائح العناية».';
  return 'راجع الطبيب أو العيادة إذا ظهر جرح أو فقاعة أو سائل أو رائحة أو تغيّر لون أو تورم أو حمى، أو إذا صار مستواك أحمر. وأنا ما أقدر أحكم على حالتك، فإذا ما كنت متأكد اكتب لي وأرسل سؤالك للممرضة.';
}

/**
 * Reply to a quick-reply button (id) or free text.
 * `extraFlags` lets a classifier (phase 5) add red flags; the result is always the more serious one.
 */
export function reply(
  input: { id?: QuickReplyId; text?: string },
  c: ChatContext,
  extraFlags: { why: string }[] = [],
  /** The classifier heard redness / new pain: ask for confirmation in the quick check (never decide). */
  confirm: string | null = null,
): { msgs: BotMsg[]; effects: Effect[] } {
  const msgs: BotMsg[] = [];
  const effects: Effect[] = [];
  const ev = (event: NewEvent) => effects.push({ type: 'event', event: { ...event, day: c.dayKey } });
  const red = (why: string, text: string) => {
    msgs.push(bot(FIXED_RED(c.familyConsent), ['photo', 'now'], 'urgent'));
    ev({ kind: 'redflag', data: { why, text: text.slice(0, 200) } });
  };

  let id: QuickReplyId | Intent | null = input.id ?? null;
  const text = (input.text ?? '').trim();
  if (!id && text) {
    const flags = [...redFlags(text), ...extraFlags];
    if (flags.length) {
      red([...new Set(flags.map((f) => f.why))].join('، '), text);
      return { msgs, effects };
    }
    if (MEDICAL.test(norm(text))) {
      msgs.push(bot(FIXED_MED));
      ev({ kind: 'question', data: { text: text.slice(0, 200) } });
      return { msgs, effects };
    }
    id = intent(text);
    const heard = confirm ?? softReports(text)[0]?.why ?? null;
    if (!id && heard) {
      msgs.push(
        bot(
          `فهمت إنك تحس بـ${heard}. عشان ينسجل صح، جاوب على الفحص السريع (ثلاث أسئلة). وإذا فيه جرح أو سائل اضغط «عندي جرح أو سائل».`,
          ['check', 'wound'],
        ),
      );
      ev({ kind: 'message', data: { text: text.slice(0, 200), heard } });
      return { msgs, effects };
    }
    if (!id) {
      msgs.push(
        bot(
          'ما فهمت تمامًا، وحفظت رسالتك للعيادة. اختر من الخيارات تحت، أو اكتب لي بوضوح لو فيه جرح أو ألم أو تغيّر في القدم.',
          ['forgot', 'tired', 'check', 'wound'],
        ),
      );
      ev({ kind: 'message', data: { text: text.slice(0, 200) } });
      return { msgs, effects };
    }
  }

  switch (id) {
    case 'why':
    case 'now':
    case 'care':
    case 'doc':
      msgs.push(
        bot(answer(id, c), id === 'care' ? [] : (['now', 'doc'].filter((x) => x !== id) as QuickReplyId[])),
      );
      if (id === 'care') effects.push({ type: 'goto', to: '/tips' });
      break;
    case 'fine':
      msgs.push(bot('الحمد لله. إذا لاحظت جرح أو احمرار أو ألم جديد اكتب لي مباشرة.'));
      break;
    case 'note':
      msgs.push(bot('تفضّل، اكتب لي الملاحظة.'));
      break;
    case 'forgot':
      msgs.push(
        bot('ولا يهمك، يصير. تبي أذكّرك كل يوم الساعة 8 مساءً؟ ولو ما قدرت تقيس، الفحص السريع يكفي لليوم.', [
          'remind',
          'check',
        ]),
      );
      break;
    case 'remind':
      msgs.push(bot('تمام، ضبطت التذكير الساعة 8 مساءً.'));
      effects.push({ type: 'reminder', time: '20:00' });
      ev({ kind: 'reminder', data: { time: '20:00' } });
      break;
    case 'tired':
      msgs.push(bot('سلامتك. اليوم يكفي الفحص السريع (ثلاث نقرات) بدل القياس الكامل.', ['check']));
      break;
    case 'stop':
      msgs.push(
        bot(
          'التنبيهات لسلامتك، فما نوقفها من المحادثة. إذا بتغيب عن السجادة (سفر مثلًا)، فعّل «وضع السفر» من الإعدادات: يوقف التذكيرات مؤقتًا، ويكفيك الفحص السريع كل يوم.',
          ['settings:modes', 'no'],
        ),
      );
      break;
    case 'settings:modes':
      msgs.push(bot('فتحت لك الإعدادات على «وضع خاص».'));
      effects.push({ type: 'goto', to: '/settings#modes' });
      break;
    case 'travel':
      msgs.push(
        bot('الله يوفقك. تبي أفعّل وضع السفر؟ نوقف تذكيرات السجادة ونطلب فحص سريع كل يوم لين ترجع.', [
          'mode:travel',
          'no',
        ]),
      );
      break;
    case 'bandage':
      msgs.push(
        bot('سلامتك. تبي أفعّل وضع الضماد؟ نوقف المقارنة بين القدمين لأن الضماد يغيّر الحرارة.', [
          'mode:bandage',
          'no',
        ]),
      );
      break;
    case 'hospital':
      msgs.push(
        bot('سلامتك يا رب. تبي نوقف التذكيرات والتنبيهات طول فترة التنويم؟', ['mode:hospital', 'no']),
      );
      break;
    case 'mode:travel':
    case 'mode:bandage':
    case 'mode:hospital':
    case 'mode:normal': {
      const mode = id.slice(5) as Mode;
      const t: Record<Mode, string> = {
        travel: 'فعّلت وضع السفر. فحص سريع كل يوم، ولما ترجع قل لي.',
        bandage: 'فعّلت وضع الضماد. افحص قدمك بالنظر كل يوم، وبنرجع للمقارنة لما تشيل الضماد.',
        hospital: 'أوقفت التنبيهات. الله يشفيك، وقل لي لما تطلع.',
        normal: 'رجعنا للوضع العادي. قِس قبل الوضوء مثل العادة.',
      };
      msgs.push(bot(t[mode], mode === 'travel' || mode === 'bandage' ? ['check'] : []));
      ev({ kind: 'mode', data: { mode } });
      break;
    }
    case 'no':
      msgs.push(bot('تمام، ما غيّرت شي.'));
      break;
    case 'check':
      msgs.push(bot('تمام، جاوب على ثلاث أسئلة.'));
      effects.push({ type: 'goto', to: '/quick' });
      break;
    case 'photo':
      msgs.push(bot('افتح شاشة التصوير وصوّر المكان. الصورة للعيادة تشوفها، وما نحللها.'));
      effects.push({ type: 'goto', to: '/photo' });
      break;
    case 'ok':
      msgs.push(bot('الله يعافيك. قِس بكرة قبل الوضوء ونتابع.'));
      break;
    case 'wound':
      red('جرح أو سائل (زر مباشر)', '');
      break;
    case 'device':
      msgs.push(
        bot('آسفين على هذا. سجّلت بلاغ للدعم عن السجادة، وفي الأثناء استخدم الفحص السريع.', ['check']),
      );
      ev({ kind: 'message', data: { topic: 'device', text: 'بلاغ من المريض: السجادة ما تقيس صح.' } });
      break;
    default:
      msgs.push(bot('ما فهمت تمامًا. اختر من الخيارات.', ['forgot', 'check']));
  }
  return { msgs, effects };
}

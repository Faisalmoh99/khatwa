import { describe, expect, test } from 'vitest';
import { priority } from './priority';
import { answer, type ChatContext, FIXED_MED, opener, reply } from './templates';
import { intent, norm, redFlags } from './understand';

const ctx = (p: Partial<ChatContext> = {}): ChatContext => ({
  level: 'green',
  reason: 'لا فرق',
  thermal: 'normal',
  site: 'رأس المشط الأول',
  foot: 'اليمنى',
  dT: 2.6,
  streak: 2,
  missed: 0,
  mode: 'normal',
  todayDone: true,
  quickDone: false,
  familyConsent: true,
  dayKey: '2026-11-10',
  ...p,
});

describe('normalisation and red flags', () => {
  test('norm unifies letters and strips punctuation', () => {
    expect(norm('إصبعي متورّمة!؟')).toBe('اصبعي متورمه');
  });
  test.each([
    ['فيه سائل يطلع من جرح في رجلي', 'discharge'],
    ['رجلي فيها جرح صغير', 'wound'],
    ['طلعت لي فقاعة تحت الإبهام', 'blister'],
    ['قدمي متورمة من أمس', 'swelling'],
    ['عندي حمى وقشعريرة', 'fever'],
    ['لون الإصبع صار أسود', 'color'],
    ['فيها ريحة مو حلوة', 'odor'],
    ['ما اقدر امشي من الوجع', 'new_pain'],
  ])('%s → %s', (text, code) => {
    expect(redFlags(text).map((f) => f.code)).toContain(code);
  });
  test.each([
    'ما فيه جرح الحمد لله',
    'ما عندي حمى',
    'ما لاحظت تورم',
    'رجلي ما فيها جرح',
    'كل شي تمام',
    'نسيت أقيس أمس',
  ])('no red flag: %s', (text) => {
    expect(redFlags(text)).toEqual([]);
  });
});

describe('intent', () => {
  test.each([
    ['أنا مسافر بكرة', 'travel'],
    ['عليها ضماد', 'bandage'],
    ['أنا منوّم في المستشفى', 'hospital'],
    ['والله نسيت', 'forgot'],
    ['السجادة ما تشتغل', 'device'],
    ['ليش قدمي برتقالية اليوم؟', 'why'],
    ['وش اسوي الحين', 'now'],
    ['تمام', 'ok'],
  ])('%s → %s', (text, id) => {
    expect(intent(text)).toBe(id);
  });
  test('unknown text = null', () => {
    expect(intent('الجو حلو اليوم')).toBeNull();
  });
});

describe('reply: escalates, never diagnoses', () => {
  test('red flag in free text → fixed urgent text + redflag event', () => {
    const r = reply({ text: 'فيه سائل يطلع من جرح في رجلي' }, ctx());
    expect(r.msgs[0]!.tone).toBe('urgent');
    expect(r.msgs[0]!.text).toContain('أبلغنا العيادة');
    expect(r.effects).toContainEqual({
      type: 'event',
      event: expect.objectContaining({
        kind: 'redflag',
        day: '2026-11-10',
        data: expect.objectContaining({ why: expect.stringContaining('سائل') }),
      }),
    });
  });
  test('red flag wins over a medical question in the same message', () => {
    const r = reply({ text: 'عندي جرح وش الدواء المناسب؟' }, ctx());
    expect(r.effects.some((e) => e.type === 'event' && e.event.kind === 'redflag')).toBe(true);
  });
  test('medical question → fixed refusal + question event for the clinic', () => {
    const r = reply({ text: 'وش أحسن مرهم لقدمي؟' }, ctx());
    expect(r.msgs[0]!.text).toBe(FIXED_MED);
    expect(r.effects).toContainEqual({ type: 'event', event: expect.objectContaining({ kind: 'question' }) });
  });
  test('classifier flags are merged (the more serious one wins)', () => {
    const r = reply({ text: 'رجلي فيها شي غريب' }, ctx(), [{ why: 'تورم' }]);
    expect(r.msgs[0]!.tone).toBe('urgent');
  });
  test('travel → offer, then mode event', () => {
    expect(reply({ text: 'مسافر' }, ctx()).msgs[0]!.replies).toContain('mode:travel');
    expect(reply({ id: 'mode:travel' }, ctx()).effects).toContainEqual({
      type: 'event',
      event: { kind: 'mode', data: { mode: 'travel' }, day: '2026-11-10' },
    });
  });
  test('unknown text is saved for the clinic', () => {
    expect(reply({ text: 'الجو حلو' }, ctx()).effects).toContainEqual({
      type: 'event',
      event: expect.objectContaining({ kind: 'message' }),
    });
  });
  test('no template ever lowers a level or names a medicine/diagnosis', () => {
    const levels = ['green', 'yellow', 'orange', 'red', 'none', 'paused'] as const;
    const texts = levels.flatMap((level) => [
      opener(ctx({ level, thermal: level === 'orange' ? 'alert' : null })).text,
      answer('why', ctx({ level })),
      answer('now', ctx({ level })),
    ]);
    for (const t of texts) {
      expect(t).not.toMatch(/مضاد حيوي|مرهم|كريم|التهاب|قرحة سكرية|تشخيصك|لا داعي للقلق|ما يحتاج تراجع/);
    }
  });
  test('opener uses correct Arabic plurals', () => {
    expect(opener(ctx({ level: 'none', thermal: null, todayDone: false, missed: 2 })).text).toContain(
      'يومين',
    );
    expect(opener(ctx({ level: 'none', thermal: null, todayDone: false, missed: 3 })).text).toContain(
      '3 أيام',
    );
    expect(opener(ctx({ level: 'orange', thermal: 'alert', streak: 2 })).text).toContain('ليومين متتاليين');
  });
  test('opener mentions the family only with consent', () => {
    expect(opener(ctx({ level: 'orange', thermal: 'alert', familyConsent: false })).text).not.toContain(
      'عائلتك',
    );
  });
  test('no template claims image analysis or a measured scan time', () => {
    const all = JSON.stringify([
      opener(ctx({ level: 'orange', thermal: 'alert' })),
      reply({ id: 'photo' }, ctx()),
      opener(ctx({ thermal: 'invalid', level: 'none' })),
    ]);
    expect(all).not.toMatch(/نحلل الصورة|تحليل الصورة|نقارنه بصورتك|\d+ ثانية/);
  });
});

describe('priority (no photo/pressure/perfusion items)', () => {
  test('hot spot 2 days', () => {
    expect(
      priority({ thermal: 'alert', streak: 2, missed: 0, redFlag: false, checkFlag: false }),
    ).toMatchObject({ score: 40, band: 'مرتفع' });
  });
  test('red flag is urgent', () => {
    expect(priority({ thermal: 'normal', streak: 0, missed: 0, redFlag: true, checkFlag: true }).band).toBe(
      'عاجل',
    );
  });
  test('missed days capped at 3', () => {
    expect(priority({ thermal: null, streak: 0, missed: 9, redFlag: false, checkFlag: false }).score).toBe(
      24,
    );
  });
  test('labels never mention photo, pressure or perfusion', () => {
    const p = priority({
      thermal: 'alert',
      streak: 4,
      missed: 3,
      redFlag: true,
      checkFlag: true,
      unresponsive: true,
    });
    expect(p.parts.map((x) => x.label).join()).not.toMatch(/صورة|ضغط|تروية/);
  });
});

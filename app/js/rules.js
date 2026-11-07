// خطوة — محرك القاعدة للجهاز الحقيقي (٤ نقاط لكل قدم)
// ملف نقي بدون Firebase ولا DOM، يشتغل في المتصفح وفي Node (للاختبارات).
// القاعدة: فرق أكبر من 2.2°م في نفس النقطة بين القدمين، في يومين متتاليين، ونفس القدم هي الأسخن (IWGDF).

export const THRESH = 2.2;            // عتبة الفرق (أكبر من، مو يساوي)
export const SITES = [               // الترتيب ثابت: هو نفس ترتيب الحساسات في الجهاز والمحاكي
  { id: 'hallux', ar: 'الإبهام' },
  { id: 'mth1', ar: 'رأس المشط الأول' },
  { id: 'mth5', ar: 'رأس المشط الخامس' },
  { id: 'heel', ar: 'الكعب' },
];
export const N = SITES.length;
export const PLAUSIBLE = { min: 20, max: 40 };   // خارجها = حرارة غير منطقية (قدم مبللة، أرض حارة، خطأ)
const DAY_MS = 86400000;
const RIYADH_OFFSET_MS = 3 * 3600000;

const round2 = v => Math.round(v * 100) / 100;

/** يحوّل قيمة من Firebase إلى مصفوفة (RTDB أحيانًا يرجع المصفوفة ككائن {0:..,1:..}) */
export function toArr(a) {
  if (Array.isArray(a)) return a;
  if (a && typeof a === 'object') return Object.keys(a).sort((x, y) => x - y).map(k => a[k]);
  return [];
}

/** عطل حساس: DS18B20 يرجع -127 لو انفصل، و85 لو انقطعت التغذية أثناء القراءة */
export function isSensorFault(v) {
  return typeof v !== 'number' || !Number.isFinite(v) || v <= -100 || v === 85;
}

/**
 * يفحص قراءة واحدة (scan) ويرجع الفرق لكل نقطة والمشاكل.
 * ok=false يعني القراءة ما تنحسب (لازم يعيد الوقوف).
 */
export function checkScan(scan) {
  const L = toArr(scan && scan.L), R = toArr(scan && scan.R);
  const issues = [];
  if (L.length !== N || R.length !== N) {
    return { ok: false, diff: [], usable: [], faults: [], flagged: [], maxSite: -1, issues: [{ code: 'shape', ar: 'شكل القراءة غير صحيح' }] };
  }
  const faults = [], implausible = [], diff = [], usable = [];
  for (let i = 0; i < N; i++) {
    const lf = isSensorFault(L[i]), rf = isSensorFault(R[i]);
    if (lf) faults.push('L' + i);
    if (rf) faults.push('R' + i);
    const bad = !lf && !rf && [L[i], R[i]].some(v => v < PLAUSIBLE.min || v > PLAUSIBLE.max);
    if (bad) implausible.push(i);
    usable[i] = !lf && !rf && !bad;
    diff[i] = usable[i] ? round2(R[i] - L[i]) : null;   // موجب = اليمين أسخن
  }
  if (scan.standingOk === false) issues.push({ code: 'standing', ar: 'الوقوف غير صحيح (قدم وحدة أو القدم مو في مكانها)' });
  if (scan.stable === false) issues.push({ code: 'unstable', ar: 'القراءة ما استقرت' });
  if (implausible.length) issues.push({ code: 'implausible', ar: 'حرارة غير منطقية. قدمك مبللة؟ كنت تمشي على أرض حارة؟' });
  if (faults.length) issues.push({ code: 'fault', ar: 'حساس معطّل: هذي النقطة بدون مقارنة', faults: faults.slice() });

  const used = diff.filter(d => d !== null);
  const allBig = used.length >= 3 && used.every(d => Math.abs(d) > THRESH) && (used.every(d => d > 0) || used.every(d => d < 0));
  if (allBig) issues.push({ code: 'allsites', ar: 'فرق كبير في كل النقاط مرة وحدة: غالبًا خطأ وقوف. أعد الوقوف' });

  const blocking = issues.some(x => ['standing', 'unstable', 'implausible', 'allsites'].includes(x.code));
  const ok = !blocking && used.length > 0;
  const flagged = ok ? diff.map((d, i) => (d !== null && Math.abs(d) > THRESH ? i : -1)).filter(i => i >= 0) : [];
  let maxSite = -1;
  diff.forEach((d, i) => { if (d !== null && (maxSite < 0 || Math.abs(d) > Math.abs(diff[maxSite]))) maxSite = i; });
  return { ok, diff, usable, faults, flagged, maxSite, issues };
}

/** مفتاح اليوم: تاريخ الرياض، أو «يوم العرض» لو وضع العرض شغّال */
export function dayKeyOf(scan, mode = 'real') {
  if (mode === 'demo' && Number.isInteger(scan.demoDay)) return { key: 'D' + scan.demoDay, idx: scan.demoDay };
  const local = new Date(Number(scan.ts) + RIYADH_OFFSET_MS);
  const key = local.toISOString().slice(0, 10);
  return { key, idx: Math.floor((Number(scan.ts) + RIYADH_OFFSET_MS) / DAY_MS) };
}

/**
 * يجمع القراءات حسب اليوم. لكل يوم نأخذ آخر قراءة صالحة.
 * scans: مصفوفة أو كائن من Firebase (المفتاح = id)
 */
export function buildDays(scans, { mode = 'real' } = {}) {
  const list = Array.isArray(scans) ? scans.slice() : Object.entries(scans || {}).map(([id, s]) => ({ id, ...s }));
  list.sort((a, b) => Number(a.ts) - Number(b.ts));
  const byKey = new Map();
  for (const s of list) {
    if (!s || s.ts == null) continue;
    if (mode === 'demo' && !Number.isInteger(s.demoDay)) continue;
    const { key, idx } = dayKeyOf(s, mode);
    if (!byKey.has(key)) byKey.set(key, { key, idx, all: [] });
    byKey.get(key).all.push({ scan: s, check: checkScan(s) });
  }
  return [...byKey.values()].sort((a, b) => a.idx - b.idx).map(d => {
    const valid = d.all.filter(x => x.check.ok);
    const pick = valid.length ? valid[valid.length - 1] : d.all[d.all.length - 1];
    return { key: d.key, idx: d.idx, valid: valid.length > 0, scan: pick.scan, check: pick.check, attempts: d.all.length };
  });
}

/**
 * يطبّق القاعدة يوم بيوم.
 * status: normal | watch (فوق العتبة يوم واحد) | alert (يومين متتاليين) | invalid
 * level:  green | yellow | orange | none
 * الأحمر ما يجي من الحساسات: يجي من بلاغ المريض (جرح، علامة خطر) ويتعامل معه التطبيق.
 */
export function evaluate(days) {
  const out = [];
  let prev = null;
  for (const d of days) {
    if (!d.valid) {
      out.push({ ...d, status: 'invalid', level: 'none', streak: new Array(N).fill(0), alertSites: [] });
      prev = null;               // يوم بدون قراءة صالحة يقطع التتابع
      continue;
    }
    const consecutive = prev && d.idx === prev.idx + 1;
    const streak = d.check.diff.map((v, i) => {
      if (v === null || Math.abs(v) <= THRESH) return 0;
      const sign = Math.sign(v);
      const ps = consecutive ? prev.check.diff[i] : null;
      const sameSide = ps !== null && ps !== undefined && Math.abs(ps) > THRESH && Math.sign(ps) === sign;
      return sameSide ? prev.streak[i] + 1 : 1;
    });
    const alertSites = streak.map((s, i) => (s >= 2 ? i : -1)).filter(i => i >= 0);
    const status = alertSites.length ? 'alert' : d.check.flagged.length ? 'watch' : 'normal';
    const level = { alert: 'orange', watch: 'yellow', normal: 'green' }[status];
    const row = { ...d, status, level, streak, alertSites };
    out.push(row);
    prev = row;
  }
  return out;
}

/** أيام بدون قياس منذ آخر يوم صالح (لسلّم المتابعة). nowTs بالملي ثانية */
export function daysSinceLastValid(days, nowTs) {
  const last = [...days].reverse().find(d => d.valid);
  if (!last) return null;
  const today = Math.floor((nowTs + RIYADH_OFFSET_MS) / DAY_MS);
  return Math.max(0, today - last.idx);
}

/**
 * خط الأساس الشخصي (فرضية منا، مو من الإرشادات): متوسط الفرق لكل نقطة في أول 7 أيام صالحة.
 * للعرض فقط، ما يغيّر القاعدة.
 */
export function baseline(days, n = 7) {
  const first = days.filter(d => d.valid).slice(0, n);
  if (!first.length) return null;
  return SITES.map((_, i) => {
    const vals = first.map(d => d.check.diff[i]).filter(v => v !== null);
    if (!vals.length) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { mean: round2(mean), n: vals.length };
  });
}

/** يجهّز سطر وصف عربي للنتيجة */
export function describe(row) {
  if (!row) return '';
  if (row.status === 'invalid') return row.check.issues.map(x => x.ar).join('، ') || 'لا قراءة صالحة';
  if (row.status === 'normal') return 'لا فرق فوق العتبة';
  const i = row.alertSites[0] ?? row.check.flagged[0];
  const d = row.check.diff[i];
  const foot = d > 0 ? 'اليمنى' : 'اليسرى';
  const base = `فرق ${Math.abs(d).toFixed(1)}° عند ${SITES[i].ar} (القدم ${foot} أسخن)`;
  return row.status === 'alert' ? `${base} لـ ${row.streak[i]} أيام متتالية` : `${base} اليوم فقط`;
}

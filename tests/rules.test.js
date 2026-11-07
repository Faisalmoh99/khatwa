import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkScan, buildDays, evaluate, THRESH } from '../app/js/rules.js';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 10, 5, 0, 0); // 10 نوفمبر 08:00 بتوقيت الرياض
const base = [31.0, 30.0, 29.5, 30.5];
const scan = (dayN, Rdelta = [0, 0, 0, 0], extra = {}) => ({
  ts: T0 + dayN * DAY,
  L: base.slice(),
  R: base.map((v, i) => +(v + Rdelta[i]).toFixed(2)),
  standingOk: true, stable: true, ...extra,
});

test('قراءة طبيعية = أخضر', () => {
  const r = evaluate(buildDays([scan(0, [0.3, -0.2, 0.1, 0])]));
  assert.equal(r[0].status, 'normal');
  assert.equal(r[0].level, 'green');
});

test('2.2 بالضبط ما ينبّه (أكبر من، مو يساوي)', () => {
  const r = evaluate(buildDays([scan(0, [0, THRESH, 0, 0])]));
  assert.equal(r[0].status, 'normal');
});

test('يوم واحد فوق العتبة = أصفر، يومين متتاليين نفس النقطة = برتقالي', () => {
  const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, 2.6, 0, 0])]));
  assert.equal(r[0].status, 'watch');
  assert.equal(r[1].status, 'alert');
  assert.equal(r[1].level, 'orange');
  assert.deepEqual(r[1].alertSites, [1]);
});

test('يوم ناقص بينهم يقطع التتابع', () => {
  const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(2, [0, 2.6, 0, 0])]));
  assert.equal(r[1].status, 'watch');
});

test('القدم الأسخن تغيّرت = ما ينبّه', () => {
  const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, -2.5, 0, 0])]));
  assert.equal(r[1].status, 'watch');
});

test('نقطتين مختلفتين = ما ينبّه', () => {
  const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, 0, 2.5, 0])]));
  assert.equal(r[1].status, 'watch');
});

test('فرق كبير في كل النقاط = خطأ وقوف، قراءة مرفوضة', () => {
  const c = checkScan(scan(0, [3, 3, 3, 3]));
  assert.equal(c.ok, false);
  assert.ok(c.issues.some(x => x.code === 'allsites'));
});

test('حساس معطّل (-127) تُستبعد نقطته وتبقى البقية', () => {
  const s = scan(0, [0, 2.5, 0, 0]);
  s.L[0] = -127;
  const c = checkScan(s);
  assert.equal(c.ok, true);
  assert.equal(c.diff[0], null);
  assert.deepEqual(c.faults, ['L0']);
  assert.deepEqual(c.flagged, [1]);
});

test('حرارة غير منطقية (قدم مبللة) = مرفوضة', () => {
  const s = scan(0); s.L[2] = 18.4;
  assert.equal(checkScan(s).ok, false);
});

test('وقوف غير صحيح = مرفوضة، ويوم مرفوض يقطع التتابع', () => {
  const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, 2.5, 0, 0], { standingOk: false }), scan(2, [0, 2.5, 0, 0])]));
  assert.equal(r[1].status, 'invalid');
  assert.equal(r[2].status, 'watch');
});

test('أكثر من قراءة في نفس اليوم: نأخذ آخر قراءة صالحة', () => {
  const a = scan(0, [0, 2.5, 0, 0]);
  const b = { ...scan(0), ts: a.ts + 60000 };
  const days = buildDays([a, b]);
  assert.equal(days.length, 1);
  assert.equal(days[0].attempts, 2);
  assert.equal(evaluate(days)[0].status, 'normal');
});

test('وضع العرض: كل demoDay يوم مستقل حتى لو بنفس الدقيقة', () => {
  const a = { ...scan(0, [0, 2.5, 0, 0]), demoDay: 1 };
  const b = { ...scan(0, [0, 2.6, 0, 0]), ts: a.ts + 30000, demoDay: 2 };
  const r = evaluate(buildDays([a, b], { mode: 'demo' }));
  assert.equal(r[1].status, 'alert');
});

test('Firebase يرجع المصفوفة ككائن', () => {
  const s = scan(0, [0, 2.5, 0, 0]);
  s.L = { 0: s.L[0], 1: s.L[1], 2: s.L[2], 3: s.L[3] };
  assert.equal(checkScan(s).ok, true);
});

import { Printer, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { LEVEL } from '@/components/kh/levels';
import { StatusBadge } from '@/components/kh/StatusBadge';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { arDate, dayLabel, dayWord } from '@/lib/format';
import { installId, summarize } from '@/lib/ai';
import { buildReport, summaryPayload, templateSummary } from '@/lib/report';
import { THRESH } from '@/lib/rules/rules';
import { serverNow } from '@/store/device';
import { REAL_ID, usePatient } from '@/store/patients';
import { useSettings } from '@/store/settings';

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section
      className="break-inside-avoid rounded border border-line bg-surface p-4 print:rounded-none print:border-0 print:border-b print:p-2"
      data-testid={testId}
    >
      <h3 className="mb-2 text-base font-semibold text-brand-900">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div
      className="rounded-sm border border-line p-2 text-center"
      style={color ? { borderTop: `4px solid ${color}` } : undefined}
    >
      <b className="num block text-2xl text-ink">{value}</b>
      <span className="text-sm text-mute">{label}</span>
    </div>
  );
}

/** Visit report for the doctor: one printable page from the real scans and events. */
export function Report() {
  const { id } = useParams();
  const p = usePatient(id ?? REAL_ID);
  const deviceId = useSettings((s) => s.deviceId);
  const r = useMemo(() => (p ? buildReport(p) : null), [p]);
  const [qr, setQr] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const url = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';

  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 0, width: 220, color: { dark: '#0A3742', light: '#FFFFFF' } }).then(
      setQr,
    );
  }, [url]);

  if (!p || !r) return <Navigate to="/" replace />;
  const askSummary = async () => {
    setSummarizing(true);
    const s = await summarize(summaryPayload(r), `${deviceId}:${installId()}`);
    setSummary(s ?? templateSummary(r)); // silent fallback to the templates
    setSummarizing(false);
  };
  const back = id ? `/clinic/patient/${id}` : '/more';
  const m = LEVEL[r.last.level];

  return (
    <AppShell
      title="تقرير الزيارة"
      back={back}
      settings={false}
      className="print:block print:max-w-none print:p-0"
    >
      <div className="flex gap-2 print:hidden">
        <Button size="lg" className="flex-1" onClick={() => window.print()} data-testid="report-print">
          <Printer /> اطبع أو احفظ PDF
        </Button>
      </div>

      <article className="grid gap-3 print:gap-2" data-testid="report">
        <header className="flex items-start justify-between gap-3 rounded border border-line bg-surface p-4 print:border-0 print:p-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="" width={36} height={36} className="rounded-sm" />
              <b className="text-xl text-brand-900">خطوة</b>
            </div>
            <h2 className="mt-1 text-xl font-semibold text-ink">تقرير زيارة القدم السكرية</h2>
            <p className="text-sm text-mute">
              {r.from && r.to ? (
                <>
                  الفترة: {dayLabel(r.from)} – {dayLabel(r.to)} ({dayWord(r.periodDays)})
                </>
              ) : (
                'ما فيه بيانات بعد'
              )}
              {' · '}أُعدّ {arDate(serverNow())}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-sm font-semibold text-brand-900">
                {r.name}
              </span>
              {!r.virtual && (
                <span className="rounded-full bg-bg px-2 py-0.5 text-sm text-ink-2">
                  الجهاز <span className="num">{deviceId}</span>
                </span>
              )}
              {r.simulated && (
                <span
                  className="rounded-full bg-lv-yellow-soft px-2 py-0.5 text-sm font-semibold text-lv-yellow-ink"
                  data-testid="report-sim"
                >
                  {r.virtual ? 'مريض افتراضي، بيانات محاكاة' : 'فيه بيانات محاكاة'}
                </span>
              )}
            </div>
          </div>
          <figure className="grid shrink-0 justify-items-center gap-1">
            {qr && (
              <img src={qr} alt="رمز QR يفتح هذا التقرير" width={96} height={96} data-testid="report-qr" />
            )}
            <figcaption className="max-w-[110px] text-center text-[11px] leading-tight text-mute">
              يفتح التقرير على جهاز مسجّل (نموذج)
            </figcaption>
          </figure>
        </header>

        <section
          className="break-inside-avoid rounded border-2 p-4"
          style={{ borderColor: m.fill, background: m.soft }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge level={r.last.level} size="lg" />
            <span className="text-base font-semibold text-ink">آخر يوم</span>
          </div>
          {r.last.reasons.length > 0 && (
            <p className="mt-1 text-base text-ink">{r.last.reasons.join('، ')}</p>
          )}
        </section>

        <Section title="ملخص للطبيب" testId="report-summary">
          {summary ? (
            <>
              <p className="text-base leading-relaxed text-ink" data-testid="report-summary-text">
                {summary}
              </p>
              <p className="mt-2 rounded-sm bg-lv-yellow-soft px-2 py-1 text-sm font-semibold text-lv-yellow-ink">
                ملخص آلي، راجع الأرقام
              </p>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => void askSummary()}
              disabled={summarizing}
              className="print:hidden"
              data-testid="report-summary-btn"
            >
              <Sparkles /> {summarizing ? 'نجهّز الملخص…' : 'ملخص للطبيب'}
            </Button>
          )}
        </Section>

        <Section title="ملخص الفترة" testId="report-stats">
          <div className="grid grid-cols-3 gap-2">
            <Stat label={`الالتزام (${r.measured}/${r.periodDays})`} value={`${r.adherencePct}%`} />
            <Stat label="أيام خضراء" value={r.counts.green} color={LEVEL.green.fill} />
            <Stat label="أيام صفراء" value={r.counts.yellow} color={LEVEL.yellow.fill} />
            <Stat label="أيام برتقالية" value={r.counts.orange} color={LEVEL.orange.fill} />
            <Stat label="أيام حمراء" value={r.counts.red} color={LEVEL.red.fill} />
            <Stat label="تنبيهات أُرسلت" value={r.escalations} />
          </div>
        </Section>

        <Section title="الحالة اليومية">
          <ol className="grid grid-cols-10 gap-1" aria-label="الحالة اليومية">
            {p.views.slice(-r.periodDays).map((v) => (
              <li
                key={v.key}
                title={`${dayLabel(v.key)}: ${LEVEL[v.level].ar}`}
                className="aspect-square rounded-sm border"
                style={{
                  background: v.level === 'none' ? 'transparent' : LEVEL[v.level].fill,
                  borderColor: v.level === 'none' ? 'var(--kh-line-strong)' : LEVEL[v.level].fill,
                }}
              />
            ))}
          </ol>
          <p className="mt-2 text-sm text-mute">من اليمين: أول يوم في الفترة. المربع الفاضي = بدون قياس.</p>
        </Section>

        <Section title="أعلى فرق بين القدمين يوميًا" testId="report-trend">
          {r.trend.some((t) => t.v !== null) ? (
            <div className="h-40" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={r.trend.map((t) => ({ ...t, label: dayLabel(t.key) }))}
                  margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
                >
                  <XAxis
                    dataKey="label"
                    reversed
                    tick={{ fontSize: 11, fill: 'var(--kh-mute)' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    orientation="right"
                    domain={[0, (max: number) => Math.max(4, Math.ceil(max))]}
                    ticks={[0, THRESH]}
                    tick={{ fontSize: 11, fill: 'var(--kh-mute)' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <ReferenceLine y={THRESH} stroke="var(--kh-ink-2)" strokeDasharray="4 4" />
                  <Line
                    dataKey="v"
                    stroke="var(--kh-brand-700)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-base text-mute">ما فيه قراءات صالحة في الفترة.</p>
          )}
          <p className="text-sm text-mute">
            الخط المتقطّع = حد التنبيه <bdi dir="ltr">2.2°</bdi> (القاعدة: نفس النقطة يومين متتاليين ونفس
            القدم الأسخن).
          </p>
        </Section>

        <Section title="أيام فوق الحد لكل نقطة" testId="report-sites">
          <table className="w-full text-base">
            <thead>
              <tr className="text-sm text-mute">
                <th className="py-1 text-start font-semibold">النقطة</th>
                <th className="py-1 font-semibold">اليسرى</th>
                <th className="py-1 font-semibold">اليمنى</th>
              </tr>
            </thead>
            <tbody>
              {r.siteFlags.map((s) => (
                <tr key={s.site} className="border-t border-line">
                  <td className="py-1.5">{s.site}</td>
                  <td className="num py-1.5 text-center font-semibold">{s.L}</td>
                  <td className="num py-1.5 text-center font-semibold">{s.R}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="التنبيهات البرتقالية والحمراء" testId="report-episodes">
          {r.episodes.length ? (
            <ul className="grid gap-2">
              {r.episodes.map((e) => (
                <li key={e.from} className="rounded-sm bg-bg p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge level={e.level} />
                    <span className="text-sm text-ink-2">
                      {e.from === e.to ? dayLabel(e.from) : `${dayLabel(e.from)} – ${dayLabel(e.to)}`} (
                      {dayWord(e.days)})
                    </span>
                  </div>
                  <p className="text-sm text-ink">{e.why}</p>
                  <p className="text-sm text-mute">الموضع: {e.where}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-mute">ما فيه تنبيهات برتقالية أو حمراء في الفترة.</p>
          )}
        </Section>

        <Section title="اللي أبلغ عنه المريض">
          <p className="text-base text-ink">
            فحوصات سريعة: <b className="num">{r.quick.total}</b> · جلد غير عادي:{' '}
            <b className="num">{r.quick.skin}</b> · ألم أو خدر جديد: <b className="num">{r.quick.pain}</b> ·
            ما قدر يعتني: <b className="num">{r.quick.skippedCare}</b>
          </p>
          {r.redflags.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {r.redflags.map((f) => (
                <li key={f.ts} className="text-base text-lv-red-ink">
                  علامة خطر ({arDate(f.ts)}): {f.why}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="صور القدم" testId="report-photos">
          {r.photos.base || r.photos.today ? (
            <div className="grid grid-cols-2 gap-3">
              {(['base', 'today'] as const).map((k) => {
                const ph = r.photos[k];
                return (
                  <figure key={k} className="grid gap-1">
                    {ph ? (
                      <img
                        src={ph.jpeg}
                        alt={k === 'base' ? 'صورة الأساس' : 'آخر صورة'}
                        className="aspect-[3/4] w-full rounded-sm object-cover"
                      />
                    ) : (
                      <div className="aspect-[3/4] rounded-sm bg-bg" />
                    )}
                    <figcaption className="text-sm text-mute">
                      {k === 'base' ? 'صورة الأساس' : 'آخر صورة'}
                      {ph ? ` · ${arDate(ph.ts)}` : ''}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <p className="text-base text-mute">ما فيه صور.</p>
          )}
          <p className="mt-2 text-sm text-mute">
            الصور للعيادة تشوفها بنفسها. ما فيه أي تحليل آلي (تحليل الصورة: إصدار قادم).
          </p>
        </Section>

        <Section title="ملاحظات الطبيب">
          <div className="grid gap-6 py-2">
            <span className="border-b border-line-strong" />
            <span className="border-b border-line-strong" />
            <span className="border-b border-line-strong" />
          </div>
        </Section>

        <footer className="text-center text-sm text-mute">
          خطوة أداة مراقبة تساعد على الإحالة، مو تشخيص. النموذج ما اختُبر سريريًا. القاعدة: IWGDF (فرق أكبر من{' '}
          <bdi dir="ltr">2.2°</bdi> يومين متتاليين).
        </footer>
      </article>
    </AppShell>
  );
}

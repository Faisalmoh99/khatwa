import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EventList } from '@/components/kh/EventList';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { serverNow, useDevice, writeEvent } from '@/store/device';
import { useToday } from '@/store/selectors';

const SLOTS = ['9:00 ص', '10:30 ص', '12:00 م', '4:00 م'];
const FMT = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Riyadh',
});

/** Next working days (no Friday), Riyadh time. */
function nextDays(now: number, n = 6): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let k = 1; out.length < n && k < 14; k++) {
    const d = new Date(now + k * 86_400_000);
    const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Riyadh' }).format(d);
    if (wd === 'Fri') continue;
    out.push({ key: new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10), label: FMT.format(d) });
  }
  return out;
}

/** Appointment request form. Demo only: no real booking system behind it. */
export function Booking() {
  const today = useToday();
  const events = useDevice((s) => s.events);
  const [days] = useState(() => nextDays(serverNow()));
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const mine = [...events].reverse().filter((e) => e.kind === 'booking');

  const submit = async () => {
    if (!date || !slot) return;
    try {
      const label = days.find((d) => d.key === date)?.label ?? date;
      await writeEvent({
        kind: 'booking',
        data: { date: label, slot, ...(note.trim() ? { note: note.trim().slice(0, 200) } : {}) },
        day: today.key,
      });
      setDone(true);
    } catch {
      setErr('ما قدرنا نرسل الطلب. تأكد من الإنترنت.');
    }
  };

  return (
    <AppShell title="حجز موعد" back>
      <span className="justify-self-start rounded-full bg-lv-yellow-soft px-3 py-1 text-sm font-semibold text-lv-yellow-ink">
        تجريبي
      </span>
      {done ? (
        <Card className="grid justify-items-center gap-3 py-8 text-center" data-testid="booking-done">
          <CalendarCheck className="size-14 text-lv-green-ink" aria-hidden />
          <p className="text-xl font-semibold text-ink">وصل طلبك للعيادة</p>
          <p className="text-base text-ink-2">
            هذي نسخة تجريبية: ما فيه حجز حقيقي، والطلب ينحفظ في السجل بس.
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/home">الرئيسية</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card className="grid gap-3">
            <CardTitle>عيادة القدم السكرية</CardTitle>
            <CardHint>اختر اليوم والوقت المناسب لك.</CardHint>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="اليوم">
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  role="radio"
                  aria-checked={date === d.key}
                  onClick={() => setDate(d.key)}
                  className={cn(
                    'min-h-touch-lg rounded border-2 px-2 text-base font-semibold',
                    date === d.key
                      ? 'border-brand-700 bg-brand-50 text-brand-900'
                      : 'border-line bg-surface text-ink',
                  )}
                  data-testid="booking-day"
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="الوقت">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={slot === s}
                  onClick={() => setSlot(s)}
                  className={cn(
                    'min-h-touch rounded border-2 px-2 text-lg font-semibold',
                    slot === s
                      ? 'border-brand-700 bg-brand-50 text-brand-900'
                      : 'border-line bg-surface text-ink',
                  )}
                  data-testid="booking-slot"
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="grid gap-1">
              <span className="text-base">ملاحظة (اختياري)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="rounded-sm border-2 border-line bg-surface p-3 text-lg"
              />
            </label>
          </Card>
          {err && <p className="text-base font-semibold text-lv-red-ink">{err}</p>}
          <Button
            size="lg"
            block
            disabled={!date || !slot}
            onClick={() => void submit()}
            data-testid="booking-submit"
          >
            أرسل الطلب
          </Button>
        </>
      )}
      {mine.length > 0 && (
        <Card className="grid gap-2">
          <CardTitle>طلباتك</CardTitle>
          <EventList events={mine} />
        </Card>
      )}
    </AppShell>
  );
}

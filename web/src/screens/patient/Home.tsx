import { BellRing, ClipboardCheck, Flame, Footprints, MessageCircle, PauseCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DayStrip } from '@/components/kh/DayStrip';
import { DeviceChip } from '@/components/kh/DeviceChip';
import { LadderCard } from '@/components/kh/LadderCard';
import { LevelHero } from '@/components/kh/LevelHero';
import { PATIENT_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ago, arDate, dayWord } from '@/lib/format';
import { parseHHMM, riyadhMinutes, streakOf } from '@/lib/ladder';
import { MODE_AR } from '@/lib/level';
import { serverNow, useDevice } from '@/store/device';
import { useDayViews, useLadder } from '@/store/selectors';
import { useSettings } from '@/store/settings';

/** Consecutive measured days ending today (or yesterday if today is not done yet). */
export function Home() {
  const views = useDayViews();
  const today = views.at(-1)!;
  const ladder = useLadder();
  const demo = useSettings((s) => s.demoMode);
  const lastScan = useDevice((s) => s.scans.at(-1));
  const loaded = useDevice((s) => s.loaded);
  const offline = useDevice((s) => !!(s.connection.retrying || s.connection.error));
  const now = serverNow();
  const streak = streakOf(ladder.views, now);
  const reminderTime = useSettings((s) => s.reminderTime);
  const reminderDue = !ladder.todayDone && !ladder.paused && riyadhMinutes(now) >= parseHHMM(reminderTime);

  return (
    <AppShell nav={PATIENT_NAV}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-mute">{arDate(now)}</p>
          <p className="text-xl font-semibold text-ink">السلام عليكم</p>
        </div>
        <DeviceChip />
      </div>

      {ladder.paused && (
        <Card
          className="flex items-center gap-3 border-line-strong bg-lv-none-soft"
          data-testid="paused-banner"
        >
          <PauseCircle className="size-7 shrink-0 text-lv-none-ink" aria-hidden />
          <p className="flex-1 text-base text-ink">
            وضع <b>{MODE_AR[ladder.mode]}</b> شغّال: التذكيرات والتصعيد متوقفة.
          </p>
          <Button variant="ghost" asChild>
            <Link to="/settings#modes">غيّر</Link>
          </Button>
        </Card>
      )}

      {reminderDue && (
        <Card
          className="flex items-center gap-3 border-lv-yellow bg-lv-yellow-soft"
          role="status"
          data-testid="reminder"
        >
          <BellRing className="size-7 shrink-0 text-lv-yellow-ink" aria-hidden />
          <p className="flex-1 text-base font-semibold text-ink">حان وقت قياس اليوم.</p>
          <Button variant="ghost" asChild>
            <Link to="/scan">قِس الحين</Link>
          </Button>
        </Card>
      )}

      <LevelHero
        level={loaded ? today.level : 'none'}
        title={loaded ? undefined : offline ? 'ما فيه اتصال' : 'جارٍ التحميل…'}
        reason={loaded ? today.reasons[0]?.ar : offline ? 'أول ما يرجع النت تظهر قراءاتك.' : undefined}
        testId="today-hero"
      >
        {today.done ? (
          <Button
            size="lg"
            block
            asChild
            variant={today.level === 'red' || today.level === 'orange' ? 'primary' : 'secondary'}
          >
            <Link to="/result">شوف النتيجة ووش تسوي</Link>
          </Button>
        ) : (
          <Button size="lg" block asChild data-testid="start-scan">
            <Link to="/scan">
              <Footprints /> ابدأ الفحص
            </Link>
          </Button>
        )}
      </LevelHero>

      <div className="grid grid-cols-2 gap-3">
        <Card className="grid gap-1 p-3">
          <span className="flex items-center gap-1.5 text-sm text-mute">
            <ClipboardCheck className="size-4" aria-hidden /> آخر فحص
          </span>
          <span className="text-lg font-semibold text-ink" data-testid="last-scan">
            {lastScan ? ago(now - lastScan.ts) : 'ما فيه'}
          </span>
        </Card>
        <Card className="grid gap-1 p-3">
          <span className="flex items-center gap-1.5 text-sm text-mute">
            <Flame className="size-4" aria-hidden /> أيام متتالية
          </span>
          <span className="text-lg font-semibold text-ink" data-testid="streak">
            {streak ? dayWord(streak) : 'ابدأ اليوم'}
          </span>
        </Card>
      </div>

      <Card className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{demo ? 'أيام العرض' : 'آخر 7 أيام'}</h2>
          <Link
            to="/history"
            className="min-h-touch content-center px-2 text-base font-semibold text-brand-700"
          >
            السجل
          </Link>
        </div>
        <DayStrip views={demo ? views : ladder.views} demo={demo} />
      </Card>

      <LadderCard state={ladder} level={today.level} />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="soft" size="lg" asChild>
          <Link to="/quick">
            <ClipboardCheck /> فحص سريع
          </Link>
        </Button>
        <Button variant="soft" size="lg" asChild>
          <Link to="/assistant">
            <MessageCircle /> المساعد
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}

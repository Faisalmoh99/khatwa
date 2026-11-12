import { Camera, ImageOff, Sparkles } from 'lucide-react';
import { writeErrorAr } from '@/data/DataSource';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FootMap } from '@/components/kh/FootMap';
import { Notice } from '@/components/kh/Notice';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import type { Photo as PhotoT } from '@/data/types';
import { arDate } from '@/lib/format';
import { toThumbnail } from '@/lib/image';
import { focusSite } from '@/lib/level';
import { SITES } from '@/lib/rules/rules';
import { useDevice, writeEvent, writePhoto } from '@/store/device';
import { useDayViews } from '@/store/selectors';
import { useSettings } from '@/store/settings';

function Slot({
  title,
  photo,
  onPick,
  busy,
  testId,
}: {
  title: string;
  photo?: PhotoT;
  onPick: () => void;
  busy: boolean;
  testId: string;
}) {
  return (
    <figure className="grid gap-2">
      <figcaption className="text-base font-semibold text-ink">{title}</figcaption>
      <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded border-2 border-dashed border-line-strong bg-bg">
        {photo ? (
          <img
            src={photo.jpeg}
            alt={title}
            className="size-full object-cover"
            data-testid={`${testId}-img`}
          />
        ) : (
          <ImageOff className="size-10 text-line-strong" aria-hidden />
        )}
      </div>
      {photo && <span className="text-sm text-mute">{arDate(photo.ts)}</span>}
      <Button
        variant={photo ? 'secondary' : 'primary'}
        onClick={onPick}
        disabled={busy}
        data-testid={`${testId}-pick`}
      >
        <Camera /> {photo ? 'صوّر من جديد' : 'صوّر'}
      </Button>
    </figure>
  );
}

/**
 * Foot photos for the clinic. Saved and shown in the visit report. NO analysis, score or level
 * comes from a photo (honesty rules): "image analysis" is a future version.
 */
export function Photo() {
  const consent = useSettings((s) => s.consents.photos);
  const photos = useDevice((s) => s.photos);
  const views = useDayViews();
  const today = views.at(-1)!;
  const focusView = [...views].reverse().find((v) => focusSite(v));
  const focus = focusSite(focusView);
  const fileRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState<'base' | 'today'>('today');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const base = [...photos].reverse().find((p) => p.role === 'base');
  const latest = [...photos].reverse().find((p) => p.role === 'today');

  const pick = (r: 'base' | 'today') => {
    setRole(r);
    setMsg(null);
    fileRef.current?.click();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const jpeg = await toThumbnail(f);
      await writePhoto({ role, jpeg, day: today.key, ...(focus ? { site: focus } : {}) });
      void writeEvent({
        kind: 'photo',
        data: { role, ...(focus ? { site: focus } : {}) },
        day: today.key,
      }).catch(() => {});
      setMsg({ ok: true, text: 'انحفظت الصورة للعيادة.' });
    } catch (e) {
      setMsg({ ok: false, text: writeErrorAr(e, 'ما قدرنا نحفظ الصورة. جرّب مرة ثانية.') });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!consent)
    return (
      <AppShell title="تصوير القدم" back>
        <Notice tone="info" title="حفظ الصور غير مفعّل">
          فعّل «حفظ صور القدم للعيادة» من{' '}
          <Link to="/settings#consents" className="font-semibold text-brand-700 underline">
            الإعدادات
          </Link>{' '}
          عشان تقدر تصوّر.
        </Notice>
      </AppShell>
    );

  return (
    <AppShell title="تصوير القدم" back>
      <Card className="grid gap-3">
        <CardTitle>{focus ? 'صوّر المكان المنبّه عليه' : 'صوّر باطن القدم'}</CardTitle>
        {focus ? (
          <>
            <p className="text-lg text-ink" data-testid="photo-focus">
              {SITES[focus.i]!.ar}، القدم {focus.foot === 'R' ? 'اليمنى' : 'اليسرى'}
            </p>
            <FootMap
              compact
              showValues={false}
              highlight={{ L: focus.foot === 'L' ? [focus.i] : [], R: focus.foot === 'R' ? [focus.i] : [] }}
            />
          </>
        ) : (
          <CardHint>ما فيه مكان منبّه عليه. صوّر باطن القدمين.</CardHint>
        )}
        <CardHint>حط ورقة بيضاء جنب القدم، وصوّر في مكان فيه ضوء.</CardHint>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Slot title="صورة الأساس" photo={base} onPick={() => pick('base')} busy={busy} testId="photo-base" />
        <Slot
          title="صورة اليوم"
          photo={latest}
          onPick={() => pick('today')}
          busy={busy}
          testId="photo-today"
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
        data-testid="photo-input"
      />

      {msg && (
        <p
          role="status"
          className={
            msg.ok ? 'text-base font-semibold text-lv-green-ink' : 'text-base font-semibold text-lv-red-ink'
          }
          data-testid="photo-msg"
        >
          {msg.text}
        </p>
      )}

      <Card className="flex gap-3 bg-brand-50" data-testid="photo-no-analysis">
        <Sparkles className="mt-0.5 size-6 shrink-0 text-brand-700" aria-hidden />
        <div>
          <p className="text-base font-semibold text-ink">تحليل الصورة: إصدار قادم</p>
          <p className="text-sm text-ink-2">
            الصورة تنحفظ للعيادة تشوفها وتطلع في تقرير الزيارة. ما نحللها ولا تغيّر مستوى اليوم.
          </p>
        </div>
      </Card>
    </AppShell>
  );
}

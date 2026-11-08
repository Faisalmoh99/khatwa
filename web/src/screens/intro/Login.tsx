import { KeyRound, Phone } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { normalizeSaudiPhone } from '@/lib/whatsapp';
import { useSettings } from '@/store/settings';

export const DEMO_OTP = '1234';

/** Demo login: phone then OTP. Not real authentication, and it says so. */
export function Login() {
  const set = useSettings((s) => s.set);
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState('');
  const valid = normalizeSaudiPhone(phone) !== null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-screen-sm flex-col gap-6 px-5 pt-10">
      <div className="grid justify-items-start gap-3">
        <img src="/logo.png" alt="" width={56} height={56} className="rounded" />
        <span className="rounded-full bg-lv-yellow-soft px-3 py-1 text-sm font-semibold text-lv-yellow-ink">
          نسخة تجريبية
        </span>
        <h1 className="text-2xl font-semibold text-brand-900">
          {step === 'phone' ? 'سجّل دخولك' : 'أدخل رمز التحقق'}
        </h1>
        <p className="text-base text-ink-2">
          {step === 'phone'
            ? 'اكتب رقم جوالك.'
            : 'هذي نسخة تجريبية: ما نرسل رسالة حقيقية. الرمز التجريبي 1234.'}
        </p>
      </div>

      {step === 'phone' ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) setStep('otp');
          }}
        >
          <label className="grid gap-2">
            <span className="text-base font-semibold">رقم الجوال</span>
            <span className="relative">
              <Phone
                className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-mute"
                aria-hidden
              />
              <input
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="05XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-h-touch-lg w-full rounded border-2 border-line bg-surface pe-4 ps-12 text-xl tracking-wide placeholder:text-line-strong focus:border-brand-500"
                data-testid="login-phone"
              />
            </span>
          </label>
          <Button size="lg" block type="submit" disabled={!valid} data-testid="login-next">
            التالي
          </Button>
        </form>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (otp === DEMO_OTP) {
              set({ session: { phone: normalizeSaudiPhone(phone) ?? phone } });
              nav('/', { replace: true });
            } else setErr('الرمز غير صحيح. جرّب 1234.');
          }}
        >
          <label className="grid gap-2">
            <span className="text-base font-semibold">الرمز</span>
            <span className="relative">
              <KeyRound
                className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-mute"
                aria-hidden
              />
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={otp}
                onChange={(e) => (setOtp(e.target.value.replace(/\D/g, '')), setErr(''))}
                className="min-h-touch-lg w-full rounded border-2 border-line bg-surface pe-4 ps-12 text-center text-3xl tracking-[0.6em] focus:border-brand-500"
                aria-invalid={!!err}
                aria-describedby="otp-err"
                data-testid="login-otp"
              />
            </span>
          </label>
          {err && (
            <p id="otp-err" role="alert" className="text-base font-semibold text-lv-red-ink">
              {err}
            </p>
          )}
          <Button size="lg" block type="submit" disabled={otp.length !== 4} data-testid="login-verify">
            تحقق
          </Button>
          <Button variant="ghost" onClick={() => (setStep('phone'), setOtp(''))}>
            غيّر الرقم
          </Button>
        </form>
      )}
    </div>
  );
}

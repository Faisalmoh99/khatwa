import { Mic, MicOff, SendHorizontal, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATIENT_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { speak, stopSpeaking, useSpeechInput } from '@/hooks/useSpeech';
import { cn } from '@/lib/cn';
import {
  type BotMsg,
  type ChatContext,
  type ChatMsg,
  opener,
  QR,
  type QuickReplyId,
  reply,
} from '@/lib/agent/templates';
import { focusSite } from '@/lib/level';
import { SITES } from '@/lib/rules/rules';
import { useChat } from '@/store/chat';
import { writeEvent } from '@/store/device';
import { useDayViews, useLadder } from '@/store/selectors';
import { useSettings } from '@/store/settings';

function useChatContext(): ChatContext {
  const views = useDayViews();
  const ladder = useLadder();
  const familyConsent = useSettings((s) => s.consents.family);
  const today = views.at(-1)!;
  return useMemo(() => {
    const f = focusSite(today);
    const t = today.thermal;
    const i = f?.i ?? Math.max(0, t?.check.maxSite ?? 0);
    const d = t?.check.diff[i] ?? 0;
    return {
      level: today.level,
      reason: today.reasons[0]?.ar ?? '',
      thermal: t?.status ?? null,
      site: SITES[i]!.ar,
      foot: (f?.foot ?? (d && d > 0 ? 'R' : 'L')) === 'R' ? 'اليمنى' : 'اليسرى',
      dT: Math.abs(d ?? 0),
      streak: t?.streak[i] ?? 0,
      missed: ladder.missed,
      mode: today.mode,
      todayDone: today.done,
      quickDone: !!today.quick,
      familyConsent,
      dayKey: today.key,
    };
  }, [today, ladder.missed, familyConsent]);
}

export function Assistant() {
  const ctx = useChatContext();
  const nav = useNavigate();
  const voice = useSettings((s) => s.voice);
  const setSettings = useSettings((s) => s.set);
  const day = useChat((s) => s.days[ctx.dayKey]);
  const setDay = useChat((s) => s.setDay);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const stateKey = [ctx.level, ctx.thermal, ctx.mode, ctx.missed, ctx.quickDone].join('|');
  const lastSpoken = useRef('');

  // The assistant opens the conversation; the opener follows the state until the patient replies.
  useEffect(() => {
    if (!day || (!day.touched && day.stateKey !== stateKey))
      setDay(ctx.dayKey, { msgs: [opener(ctx)], touched: false, stateKey });
  }, [day, stateKey, ctx, setDay]);

  const msgs = useMemo(() => day?.msgs ?? [], [day]);
  const lastBot = [...msgs].reverse().find((m): m is BotMsg => m.who === 'bot');

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    if (voice && lastBot && lastBot.text !== lastSpoken.current) {
      lastSpoken.current = lastBot.text;
      speak(lastBot.text);
    }
  }, [msgs.length, voice, lastBot]);
  useEffect(() => () => stopSpeaking(), []);

  const send = (input: { id?: QuickReplyId; text?: string }) => {
    const userText = input.text ?? (input.id ? QR[input.id] : '');
    if (!userText.trim()) return;
    const r = reply(input, ctx);
    const next: ChatMsg[] = [...msgs, { who: 'user', text: userText }, ...r.msgs];
    setDay(ctx.dayKey, { msgs: next, touched: true, stateKey });
    for (const e of r.effects) {
      if (e.type === 'event') void writeEvent(e.event).catch(() => {});
      if (e.type === 'reminder') setSettings({ reminderTime: e.time });
      if (e.type === 'goto') setTimeout(() => nav(e.to), 900);
    }
  };

  const mic = useSpeechInput((t) => send({ text: t }));

  return (
    <AppShell
      title="المساعد"
      nav={PATIENT_NAV}
      className="pb-56"
      end={
        <button
          type="button"
          onClick={() => (voice && stopSpeaking(), setSettings({ voice: !voice }))}
          aria-label={voice ? 'أوقف قراءة الردود' : 'شغّل قراءة الردود'}
          aria-pressed={voice}
          className="grid size-12 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
          data-testid="voice-toggle"
        >
          {voice ? <Volume2 className="size-6" /> : <VolumeX className="size-6" />}
        </button>
      }
    >
      <p className="text-center text-sm text-mute">
        ردود مكتوبة مسبقًا. المساعد ما يشخّص ولا يصف دواء، ويبلّغ العيادة إذا احتجت.
      </p>
      <ol ref={listRef} className="grid gap-3" aria-live="polite" data-testid="chat">
        {msgs.map((m, i) =>
          m.who === 'bot' ? (
            <li key={i} className="flex items-end gap-2">
              <img src="/logo.png" alt="" width={32} height={32} className="mb-1 shrink-0 rounded-full" />
              <p
                className={cn(
                  'max-w-[85%] rounded-lg rounded-es-sm border px-4 py-3 text-lg leading-relaxed text-ink shadow-card',
                  m.tone === 'urgent' ? 'border-2 border-lv-red bg-lv-red-soft' : 'border-line bg-surface',
                )}
                data-testid={m.tone === 'urgent' ? 'chat-urgent' : 'chat-bot'}
              >
                {m.text}
              </p>
            </li>
          ) : (
            <li key={i} className="flex justify-end">
              <p
                className="max-w-[85%] rounded-lg rounded-ee-sm bg-brand-700 px-4 py-3 text-lg text-white"
                data-testid="chat-user"
              >
                {m.text}
              </p>
            </li>
          ),
        )}
      </ol>

      <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto grid max-w-screen-sm gap-2 px-4 py-3">
          {lastBot && lastBot.replies.length > 0 && (
            <div className="flex max-h-[112px] flex-wrap gap-2 overflow-y-auto" data-testid="quick-replies">
              {lastBot.replies.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => send({ id })}
                  className={cn(
                    'min-h-touch shrink-0 rounded-full border-2 px-4 text-base font-semibold',
                    id === 'wound'
                      ? 'border-lv-red text-lv-red-ink'
                      : 'border-brand-300 bg-surface text-brand-900',
                  )}
                >
                  {QR[id]}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send({ text });
              setText('');
            }}
          >
            {mic.supported && (
              <button
                type="button"
                onClick={mic.listening ? mic.stop : mic.start}
                aria-label={mic.listening ? 'أوقف التسجيل' : 'تكلّم بدل الكتابة'}
                aria-pressed={mic.listening}
                className={cn(
                  'grid size-12 shrink-0 place-items-center rounded-full border-2',
                  mic.listening
                    ? 'animate-soft-pulse border-lv-red bg-lv-red-soft text-lv-red-ink'
                    : 'border-brand-300 text-brand-700',
                )}
                data-testid="mic"
              >
                {mic.listening ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </button>
            )}
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mic.listening ? 'نسمعك…' : 'اكتب رسالتك…'}
              aria-label="رسالتك"
              className="min-h-touch min-w-0 flex-1 rounded-full border-2 border-line bg-surface px-4 text-lg focus:border-brand-500"
              data-testid="chat-input"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="أرسل"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-700 text-white disabled:opacity-40"
              data-testid="chat-send"
            >
              <SendHorizontal className="size-6 -scale-x-100" />
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

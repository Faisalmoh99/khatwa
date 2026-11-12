import { useCallback, useEffect, useRef, useState } from 'react';

/** Arabic text-to-speech (browser voice). Silent if unsupported. */
export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[⁦-⁩]/g, ''));
    u.lang = 'ar-SA';
    u.rate = 0.92;
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('ar'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {
    /* no voice available */
  }
}

export function stopSpeaking() {
  try {
    speechSynthesis.cancel();
  } catch {
    /* noop */
  }
}

interface SR {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SRCtor = new () => SR;

export function speechInputCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Arabic voice input (Web Speech API). `supported` is false on browsers without it: hide the button. */
export function useSpeechInput(onText: (t: string) => void) {
  const [supported] = useState(() => speechInputCtor() !== null);
  const [listening, setListening] = useState(false);
  const rec = useRef<SR | null>(null);
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  });

  const start = useCallback(() => {
    const C = speechInputCtor();
    if (!C) return;
    stopSpeaking();
    const r = new C();
    r.lang = 'ar-SA';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript?.trim();
      if (t) cb.current(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, start, stop };
}

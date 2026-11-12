import { useEffect, useState } from 'react';

/** Re-renders every `ms` and returns Date.now(). For "last seen" labels. */
export function useNow(ms = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** True only after `value` has stayed true for `ms` (avoids flashing banners on startup). */
export function useDelayed(value: boolean, ms = 1500) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!value) return;
    const t = setTimeout(() => setElapsed(true), ms);
    return () => {
      clearTimeout(t);
      setElapsed(false);
    };
  }, [value, ms]);
  return value && elapsed;
}

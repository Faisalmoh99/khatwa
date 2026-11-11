import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '@/store/settings';
import { TOUR_RAFIQ_TEXT, TOUR_STEPS, tourSource, useTour } from '@/store/tour';

const SCAN_DAY: Record<string, number> = { scan1: 1, scan2: 2 };

/**
 * Drives the tour (mounted once in App): opens each step's screen with the right role, runs the
 * simulated stand, and moves on from a scan step when the scan screen opens the result by itself.
 */
export function useTourDriver() {
  const active = useTour((s) => s.active);
  const step = useTour((s) => s.step);
  const nav = useNavigate();
  const { pathname } = useLocation();
  const ran = useRef<string | null>(null);
  const cur = active ? TOUR_STEPS[step] : undefined;

  useEffect(() => {
    if (!cur) {
      ran.current = null;
      return;
    }
    const key = `${step}:${cur.id}`;
    if (ran.current === key) return;
    ran.current = key;
    if (useSettings.getState().role !== cur.role) useSettings.getState().set({ role: cur.role });
    useTour.getState().set({ draft: cur.id === 'rafiq' ? TOUR_RAFIQ_TEXT : '' });
    nav(cur.route);
    const day = SCAN_DAY[cur.action];
    if (day)
      void tourSource().then((src) => {
        // Wait until the screen has subscribed, so the scan counts as "arrived while open".
        setTimeout(() => src.startScan('hot', { demoDay: day }), 400);
      });
  }, [cur, step, nav]);

  // A scan step is done when the scan screen (seen during this step) opens the result.
  const seenScan = useRef<string | null>(null);
  useEffect(() => {
    if (!cur || cur.action === 'none') return;
    const key = `${step}:${cur.id}`;
    if (pathname === '/scan') seenScan.current = key;
    else if (pathname === '/result' && seenScan.current === key) useTour.getState().set({ step: step + 1 });
  }, [cur, pathname, step]);

  // Point at the WhatsApp button on the family-alert step.
  useEffect(() => {
    if (cur?.id !== 'family-alert') return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[data-testid=wa-family]');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.classList.add('tour-spot');
    }, 300);
    return () => clearTimeout(t);
  }, [cur, pathname]);
}

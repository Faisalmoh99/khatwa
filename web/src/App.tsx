import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ConnectionBanner, SourceBanner } from '@/components/kh/Banners';
import { useTourDriver } from '@/hooks/useTourDriver';
import { UpdateBanner } from '@/components/kh/UpdateBanner';
import { Consent } from '@/screens/intro/Consent';
import { Login } from '@/screens/intro/Login';
import { Onboarding } from '@/screens/intro/Onboarding';
import { RoleSelect } from '@/screens/intro/RoleSelect';
import { Splash } from '@/screens/intro/Splash';
import { ComingSoon } from '@/screens/patient/ComingSoon';
import { Device } from '@/screens/patient/Device';
import { Tips } from '@/screens/patient/Tips';
import { Home } from '@/screens/patient/Home';
import { More } from '@/screens/patient/More';
import { QuickCheck } from '@/screens/patient/QuickCheck';
import { Result } from '@/screens/patient/Result';
import { Scan } from '@/screens/patient/Scan';
import { Settings } from '@/screens/patient/Settings';
import { type Role, useSettings } from '@/store/settings';
import { startTour, useTour } from '@/store/tour';
import { useEscalationWriter } from '@/store/useEscalationWriter';
import { useSourceBinding } from '@/store/useSourceBinding';

/** Heavy screens (charts, clinic, report) load on demand; the service worker precaches them for offline use. */
const Audit = lazy(() => import('@/screens/clinic/Audit').then((m) => ({ default: m.Audit })));
const PatientDetail = lazy(() =>
  import('@/screens/clinic/PatientDetail').then((m) => ({ default: m.PatientDetail })),
);
const Patients = lazy(() => import('@/screens/clinic/Patients').then((m) => ({ default: m.Patients })));
const RuleLab = lazy(() => import('@/screens/clinic/RuleLab').then((m) => ({ default: m.RuleLab })));
const FamilyHome = lazy(() => import('@/screens/family/FamilyHome').then((m) => ({ default: m.FamilyHome })));
const History = lazy(() => import('@/screens/patient/History').then((m) => ({ default: m.History })));
const Report = lazy(() => import('@/screens/patient/Report').then((m) => ({ default: m.Report })));
const Booking = lazy(() => import('@/screens/patient/Booking').then((m) => ({ default: m.Booking })));
const Assistant = lazy(() => import('@/screens/patient/Assistant').then((m) => ({ default: m.Assistant })));
const Photo = lazy(() => import('@/screens/patient/Photo').then((m) => ({ default: m.Photo })));

const HOME: Record<Role, string> = { patient: '/home', family: '/family', clinic: '/clinic' };

/** Where a user should be right now: onboarding → consent → login → role → their home. */
function useEntry(): string {
  const s = useSettings();
  if (!s.onboarded) return '/welcome';
  if (!s.consents.core) return '/consent';
  if (!s.session) return '/login';
  if (!s.role) return '/role';
  return HOME[s.role];
}

function Gate() {
  return <Navigate to={useEntry()} replace />;
}

/** Protects role screens: anyone not fully set up goes back through the gate. */
function RequireRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const s = useSettings();
  // The tour switches roles between steps itself; a role mismatch mid-switch must not bounce it home.
  const touring = useTour((t) => t.active);
  const ok =
    s.onboarded &&
    s.consents.core &&
    s.session &&
    s.role &&
    (touring || (Array.isArray(role) ? role.includes(s.role) : s.role === role));
  return ok ? <>{children}</> : <Navigate to="/" replace />;
}

/** New screen = start at the top (the browser would keep the previous scroll position). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * The banners stay at the top while the page scrolls, so the data source is always visible.
 * Their height goes into --kh-banner-h; the sticky top bar sits right under them.
 */
function StickyBanners() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--kh-banner-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--kh-banner-h');
    };
  }, []);
  return (
    <div ref={ref} className="sticky top-0 z-30 print:hidden" data-testid="banners">
      <SourceBanner />
      <ConnectionBanner />
    </div>
  );
}

/** Inside the router: the tour navigates between screens. */
function TourDriver() {
  useTourDriver();
  useTourDeepLink();
  return null;
}

/**
 * `?tour=1` (the landing page's «جرّب التطبيق» button) opens straight into the guided tour.
 * The parameter is removed so a reload or a home-screen shortcut does not restart it.
 */
let deepLinkHandled = false;
function useTourDeepLink() {
  useEffect(() => {
    if (deepLinkHandled) return;
    deepLinkHandled = true;
    const url = new URL(location.href);
    if (!url.searchParams.has('tour')) return;
    url.searchParams.delete('tour');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    if (!useTour.getState().active) startTour();
  }, []);
}

function useSplash() {
  const [show, setShow] = useState(() => !new URLSearchParams(location.search).has('nosplash'));
  useEffect(() => {
    if (!show) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setShow(false), reduce ? 300 : 1100);
    return () => clearTimeout(t);
  }, [show]);
  return show;
}

export function App() {
  useSourceBinding();
  useEscalationWriter();
  const splash = useSplash();
  const P = (el: ReactNode) => <RequireRole role="patient">{el}</RequireRole>;
  const C = (el: ReactNode) => <RequireRole role="clinic">{el}</RequireRole>;
  const ANY = (el: ReactNode) => <RequireRole role={['patient', 'family', 'clinic']}>{el}</RequireRole>;

  return (
    <BrowserRouter>
      <ScrollToTop />
      <TourDriver />
      <UpdateBanner />
      {splash && <Splash />}
      {/* Honesty banners on every screen, including the welcome and login screens. Pinned while scrolling. */}
      <StickyBanners />
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Gate />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/consent" element={<Consent />} />
          <Route path="/login" element={<Login />} />
          <Route path="/role" element={<RoleSelect />} />

          <Route path="/home" element={P(<Home />)} />
          <Route path="/scan" element={P(<Scan />)} />
          <Route path="/result" element={P(<Result />)} />
          <Route path="/quick" element={P(<QuickCheck />)} />
          <Route path="/more" element={P(<More />)} />
          <Route path="/history" element={P(<History />)} />
          <Route path="/assistant" element={P(<Assistant />)} />
          <Route path="/photo" element={P(<Photo />)} />
          <Route path="/tips" element={ANY(<Tips />)} />
          <Route path="/coming-soon" element={ANY(<ComingSoon />)} />
          <Route path="/device" element={ANY(<Device />)} />
          <Route path="/settings" element={ANY(<Settings />)} />

          <Route path="/report" element={ANY(<Report />)} />
          <Route path="/booking" element={P(<Booking />)} />

          <Route path="/family" element={<RequireRole role="family">{<FamilyHome />}</RequireRole>} />
          <Route path="/clinic" element={C(<Patients />)} />
          <Route path="/clinic/patient/:id" element={C(<PatientDetail />)} />
          <Route path="/clinic/patient/:id/report" element={C(<Report />)} />
          <Route path="/clinic/audit" element={C(<Audit />)} />
          <Route path="/clinic/lab" element={C(<RuleLab />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

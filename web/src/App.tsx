import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Consent } from '@/screens/intro/Consent';
import { Login } from '@/screens/intro/Login';
import { Onboarding } from '@/screens/intro/Onboarding';
import { RoleSelect } from '@/screens/intro/RoleSelect';
import { Splash } from '@/screens/intro/Splash';
import { Audit } from '@/screens/clinic/Audit';
import { PatientDetail } from '@/screens/clinic/PatientDetail';
import { Patients } from '@/screens/clinic/Patients';
import { RuleLab } from '@/screens/clinic/RuleLab';
import { FamilyHome } from '@/screens/family/FamilyHome';
import { Assistant } from '@/screens/patient/Assistant';
import { Booking } from '@/screens/patient/Booking';
import { Report } from '@/screens/patient/Report';
import { ComingSoon } from '@/screens/patient/ComingSoon';
import { Device } from '@/screens/patient/Device';
import { History } from '@/screens/patient/History';
import { Photo } from '@/screens/patient/Photo';
import { Tips } from '@/screens/patient/Tips';
import { Home } from '@/screens/patient/Home';
import { More } from '@/screens/patient/More';
import { QuickCheck } from '@/screens/patient/QuickCheck';
import { Result } from '@/screens/patient/Result';
import { Scan } from '@/screens/patient/Scan';
import { Settings } from '@/screens/patient/Settings';
import { type Role, useSettings } from '@/store/settings';
import { useEscalationWriter } from '@/store/useEscalationWriter';
import { useSourceBinding } from '@/store/useSourceBinding';

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
  const ok =
    s.onboarded &&
    s.consents.core &&
    s.session &&
    s.role &&
    (Array.isArray(role) ? role.includes(s.role) : s.role === role);
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
      {splash && <Splash />}
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

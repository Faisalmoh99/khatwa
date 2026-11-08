import {
  ClipboardList,
  FlaskConical,
  Footprints,
  History,
  House,
  LayoutGrid,
  MessageCircle,
  Users,
} from 'lucide-react';
import type { NavItem } from './BottomNav';

export const PATIENT_NAV: NavItem[] = [
  { to: '/home', label: 'الرئيسية', icon: House },
  { to: '/scan', label: 'الفحص', icon: Footprints },
  { to: '/history', label: 'السجل', icon: History },
  { to: '/assistant', label: 'المساعد', icon: MessageCircle },
  { to: '/more', label: 'المزيد', icon: LayoutGrid },
];

export const CLINIC_NAV: NavItem[] = [
  { to: '/clinic', label: 'المرضى', icon: Users, end: true },
  { to: '/clinic/audit', label: 'سجل التدقيق', icon: ClipboardList },
  { to: '/clinic/lab', label: 'مختبر القاعدة', icon: FlaskConical },
];

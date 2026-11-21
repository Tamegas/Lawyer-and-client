import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Logo } from './Logo.jsx';

const NAV = {
  client: [
    { to: '/client', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/client/requests', label: 'My legal requests', icon: 'file-text' },
    { to: '/messages', label: 'Messages', icon: 'message' },
    { to: '/client/quotations', label: 'Fee quotations', icon: 'coins' },
    { to: '/client/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/client/saved', label: 'Saved lawyers', icon: 'heart' },
    { to: '/account', label: 'Account & privacy', icon: 'user' },
  ],
  lawyer: [
    { to: '/lawyer', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/lawyer/profile', label: 'My profile', icon: 'briefcase' },
    { to: '/messages', label: 'Inquiries', icon: 'inbox' },
    { to: '/lawyer/quotations', label: 'Fee quotations', icon: 'coins' },
    { to: '/lawyer/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/account', label: 'Account & privacy', icon: 'user' },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: 'bar-chart', end: true },
    { to: '/admin/applications', label: 'Verification', icon: 'shield-check' },
    { to: '/admin/reports', label: 'Reports & complaints', icon: 'flag' },
    { to: '/admin/reviews', label: 'Review moderation', icon: 'star' },
    { to: '/admin/cases', label: 'Case summaries', icon: 'scroll' },
    { to: '/admin/taxonomy', label: 'Categories & locations', icon: 'list' },
    { to: '/admin/users', label: 'Accounts', icon: 'users' },
    { to: '/admin/audit', label: 'Audit log', icon: 'file-text' },
    { to: '/account', label: 'Account', icon: 'user' },
  ],
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [pathname]);
  const items = NAV[user?.role] ?? [];
  const cls = ({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${isActive ? 'bg-navy-900 text-white' : 'text-navy-700 hover:bg-navy-100'}`;
  const signOut = async () => { try { await logout(); } finally { navigate('/'); } };

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {items.map((i) => (
        <NavLink key={i.to + i.label} to={i.to} end={i.end} className={cls}>
          <Icon name={i.icon} className="h-5 w-5 shrink-0" />{i.label}
        </NavLink>
      ))}
      <button type="button" onClick={signOut} className="mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-navy-700 hover:bg-navy-100">
        <Icon name="logout" className="h-5 w-5" />Sign out
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-navy-50/60">
      <a href="#main" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-navy-100 bg-white px-4 lg:hidden">
        <Logo />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="dash-drawer" aria-label={open ? 'Close menu' : 'Open menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-navy-50"><Icon name={open ? 'x' : 'menu'} className="h-6 w-6" /></button>
      </header>
      {open ? <div id="dash-drawer" className="border-b border-navy-100 bg-white p-4 lg:hidden">{nav}</div> : null}
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 space-y-5">
            <Logo />
            <div className="rounded-xl bg-white p-3 ring-1 ring-navy-100">
              <p className="truncate text-sm font-semibold text-navy-950">{user?.fullName}</p>
              <p className="text-xs capitalize text-navy-600">{user?.role} account</p>
            </div>
            {nav}
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}

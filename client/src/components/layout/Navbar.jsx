import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleHome } from '../../lib/labels.js';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Logo } from './Logo.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/lawyers', label: 'Find a Lawyer' },
  { to: '/categories', label: 'Legal Categories' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/about', label: 'About Us' },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => { setOpen(false); setMenu(false); }, [location.pathname]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const signOut = async () => { try { await logout(); } finally { navigate('/'); } };
  const link = ({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-navy-950 bg-navy-100' : 'text-navy-700 hover:bg-navy-50 hover:text-navy-950'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={link}>{l.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <div className="relative" ref={menuRef}>
              <button type="button" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-navy-900 ring-1 ring-navy-200 hover:bg-navy-50">
                <Icon name="user" className="h-4 w-4" />{user.fullName?.split(' ')[0] ?? 'Account'}<Icon name="chevron-down" className="h-4 w-4" />
              </button>
              {menu ? (
                <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-navy-100">
                  <Link role="menuitem" to={roleHome[user.role] ?? '/'} className="block rounded-md px-3 py-2 text-sm hover:bg-navy-50">Dashboard</Link>
                  <Link role="menuitem" to="/messages" className="block rounded-md px-3 py-2 text-sm hover:bg-navy-50">Messages</Link>
                  <Link role="menuitem" to="/account" className="block rounded-md px-3 py-2 text-sm hover:bg-navy-50">Account &amp; privacy</Link>
                  <button role="menuitem" type="button" onClick={signOut} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-navy-50">Sign out</button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Button to="/login" variant="ghost">Sign In</Button>
              <Button to="/register" variant="gold">Get Started</Button>
            </>
          )}
        </div>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-navy-900 hover:bg-navy-50 lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'x' : 'menu'} className="h-6 w-6" />
        </button>
      </div>
      {open ? (
        <div id="mobile-nav" className="border-t border-navy-100 bg-white px-4 pb-5 pt-3 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {LINKS.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={link}>{l.label}</NavLink>)}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            {user ? (
              <>
                <Button to={roleHome[user.role] ?? '/'} variant="secondary" fullWidth>Dashboard</Button>
                <Button variant="ghost" fullWidth onClick={signOut}>Sign out</Button>
              </>
            ) : (
              <>
                <Button to="/login" variant="secondary" fullWidth>Sign In</Button>
                <Button to="/register" variant="gold" fullWidth>Get Started</Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

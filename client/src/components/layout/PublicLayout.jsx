import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer.jsx';
import { Navbar } from './Navbar.jsx';

export function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main" className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}

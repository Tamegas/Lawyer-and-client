import { Link } from 'react-router-dom';
import { BRAND } from '../../lib/brand.js';
import { Logo } from './Logo.jsx';

const COLS = [
  { title: 'Platform', links: [['Find a Lawyer', '/lawyers'], ['Legal Categories', '/categories'], ['How It Works', '/how-it-works'], ['Fee Discussion Assistant', '/fee-assistant'], ['Describe My Legal Problem', '/describe-problem']] },
  { title: 'Company', links: [['About', '/about'], ['Contact', '/contact'], ['Help Center', '/help']] },
  { title: 'Legal', links: [['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['Legal Disclaimer', '/disclaimer']] },
];

export function Footer() {
  return (
    <footer className="bg-navy-950 text-navy-200">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-6 text-navy-300">{BRAND.tagline}. {BRAND.name} helps people find and contact legal professionals. It is not a law firm and does not give legal advice.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-sans text-sm font-semibold uppercase tracking-wider !text-gold-300">{c.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, to]) => <li key={to}><Link to={to} className="!text-navy-200 hover:!text-white">{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs leading-5 text-navy-400 sm:px-6 lg:px-8">
          Information on this site is general and is not legal advice. Profiles marked “Demo profile” are fictional and exist only to demonstrate the product. © {new Date().getFullYear()} {BRAND.name} (working name).
        </p>
      </div>
    </footer>
  );
}

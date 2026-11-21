import { Link } from 'react-router-dom';
import { BRAND } from '../../lib/brand.js';
import { Icon } from '../ui/Icon.jsx';

export function Logo({ light = false, className = '' }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label={`${BRAND.name} home`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-gold-300 shadow-sm"><Icon name="scale" className="h-5 w-5" /></span>
      <span className={`font-serif text-xl font-semibold tracking-tight ${light ? 'text-white' : 'text-navy-950'}`}>{BRAND.name}</span>
    </Link>
  );
}

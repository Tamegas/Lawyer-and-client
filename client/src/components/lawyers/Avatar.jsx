import { initials } from '../../lib/format.js';

const SIZES = { sm: 'h-10 w-10 text-sm', md: 'h-14 w-14 text-lg', lg: 'h-24 w-24 text-3xl' };

/** Placeholder avatar (initials). No real photographs are shipped; profile photos are not uploaded in this MVP. */
export function Avatar({ name, size = 'md', className = '' }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy-800 to-navy-950 font-serif font-semibold text-gold-300 ring-2 ring-gold-300/60 ${SIZES[size]} ${className}`}>
      {initials(name)}
    </span>
  );
}

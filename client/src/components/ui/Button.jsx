import { Link } from 'react-router-dom';
import { Icon } from './Icon.jsx';
import { Spinner } from './Feedback.jsx';

export const BUTTON_VARIANTS = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 shadow-sm',
  gold: 'bg-gold-400 text-navy-950 hover:bg-gold-300 shadow-sm font-semibold',
  secondary: 'bg-white text-navy-900 ring-1 ring-inset ring-navy-200 hover:bg-navy-50',
  ghost: 'text-navy-800 hover:bg-navy-100',
  danger: 'bg-red-700 text-white hover:bg-red-800 shadow-sm',
  link: 'text-navy-800 underline underline-offset-4 hover:text-navy-950 !min-h-0 !px-0',
};
export const BUTTON_SIZES = { sm: 'min-h-9 px-3 text-sm', md: 'min-h-11 px-5 text-sm', lg: 'min-h-12 px-6 text-base' };

/**
 * <Button variant size icon loading fullWidth to href disabled onClick type>
 * `to` renders a router link, `href` a plain anchor, otherwise a <button type="button"> (use type="submit" in forms).
 */
export function Button({ variant = 'primary', size = 'md', icon, iconRight, loading = false, fullWidth = false, to, href, className = '', children, disabled, type = 'button', ...rest }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`;
  const inner = (
    <>
      {loading ? <Spinner className="h-4 w-4" /> : icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} className="h-4 w-4" /> : null}
    </>
  );
  if (to && !disabled) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  if (href && !disabled) return <a href={href} className={cls} {...rest}>{inner}</a>;
  return <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{inner}</button>;
}

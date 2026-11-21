// Inline SVG icon set (24×24, 1.75 stroke) — no icon library. <Icon name="search" className="h-5 w-5" />
const P = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: <><path d="M12 3.5 21.5 20h-19L12 3.5Z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5h.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  'eye-off': <><path d="M4 4l16 16" /><path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.9M6.5 7.7A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.4 3.8-.9" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 12.5h10L18 7M9 7V4.5h6V7" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
  'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  filter: <path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z" />,
  scale: <><path d="M12 4v16M7 20h10M5 7h14" /><path d="M5 7 2.5 13a3 3 0 0 0 5 0L5 7ZM19 7l-2.5 6a3 3 0 0 0 5 0L19 7Z" /></>,
  gavel: <><path d="m13 6 5 5M9.5 9.5l5 5M4 20l7-7" /><path d="m10 4 6 6-3 3-6-6 3-3ZM15 14l5 5" /></>,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 10v9.5h12V10" /></>,
  building: <><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20.5v-4h4v4" /></>,
  handshake: <><path d="M3 12l4-4 4 2 4-2 6 5-3 3" /><path d="m7 15 3 3 2-1 3 2 2-2" /></>,
  passport: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M9 16.5h6" /></>,
  shield: <path d="M12 3.5 19.5 6v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6L12 3.5Z" />,
  'shield-check': <><path d="M12 3.5 19.5 6v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6L12 3.5Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  document: <><path d="M7 3.5h7l4 4V20.5H7V3.5Z" /><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5" /></>,
  'file-text': <><path d="M7 3.5h7l4 4V20.5H7V3.5Z" /><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5" /></>,
  phone: <path d="M6 4h3l1.5 4-2 1.3a11 11 0 0 0 5.2 5.2L15 12.5l4 1.5v3a2 2 0 0 1-2 2A13 13 0 0 1 4 6a2 2 0 0 1 2-2Z" />,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5H5V6h5" /></>,
  download: <><path d="M12 4v11m-4-4 4 4 4-4" /><path d="M5 19.5h14" /></>,
  upload: <><path d="M12 16V5m-4 4 4-4 4 4" /><path d="M5 19.5h14" /></>,
  logout: <><path d="M10 4.5H5.5v15H10M15 8l4 4-4 4M19 12H9" /></>,
  'bell-off': <><path d="M4 4l16 16M8.5 4.8A6 6 0 0 1 18 10v3l2 3.5H9M6 10v3l-2 3.5h2" /><path d="M10 20h4" /></>,
  'video-off': <><path d="M4 4l16 16" /><path d="M16 11.5 21 8v8l-5-3.5M4.5 7H13a2 2 0 0 1 2 2v6M4 8v8a2 2 0 0 0 2 2h8" /></>,
  'credit-card-off': <><path d="M4 4l16 16" /><path d="M7 5.5h11a2 2 0 0 1 2 2V16M4 10h8M4 8v8a2 2 0 0 0 2 2h10" /></>,
  sparkle: <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5ZM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />,
  refresh: <><path d="M20 11A8 8 0 0 0 5.6 7M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.4 4M20 20v-4h-4" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></>,
  send: <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" />,
  dashboard: <><rect x="3.5" y="3.5" width="7" height="8" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.5" /></>,
  message: <path d="M4 5.5h16v11H9.5L5 20v-3.5H4v-11Z" />,
  inbox: <><path d="M4 13.5 6.5 5h11l2.5 8.5V19H4v-5.5Z" /><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" /></>,
  coins: <><ellipse cx="9" cy="8" rx="5.5" ry="3" /><path d="M3.5 8v4c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3V8" /><path d="M15 10.5c3 .2 5.5 1.4 5.5 3v3.5c0 1.7-2.5 3-5.5 3-1.6 0-3-.4-4-1" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.6-4 3.6-6 7.5-6s6.9 2 7.5 6" /></>,
  users: <><circle cx="9" cy="8.5" r="3.3" /><path d="M2.5 19.5c.5-3.5 3-5.3 6.5-5.3s6 1.8 6.5 5.3" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M18 14.5c1.9.6 3.1 2.2 3.5 5" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 13h17" /></>,
  'bar-chart': <path d="M5 20V11M12 20V5M19 20v-6" />,
  flag: <><path d="M5.5 21V4" /><path d="M5.5 5h12l-2.5 4 2.5 4h-12" /></>,
  star: <path d="m12 3.8 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8 6.9 19.5l1-5.7-4.1-4 5.7-.8L12 3.8Z" />,
  scroll: <><path d="M7 4.5h11a1.5 1.5 0 0 1 1.5 1.5v1.5H9.5" /><path d="M7 4.5A2.5 2.5 0 0 0 4.5 7v1.5H9.5V17a2.5 2.5 0 0 0 5 0v-.5H19.5a1 1 0 0 1 0 2H9" /></>,
  list: <path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  'map-pin': <><path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.500 18.300 12 21c-2.500-2.700-3.800-5.700-3.800-9S9.500 5.700 12 3Z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
};

export function Icon({ name, className = 'h-5 w-5', title, ...rest }) {
  const body = P[name];
  if (!body) {
    if (import.meta.env?.DEV) console.warn(`Unknown icon "${name}"`);
    return null;
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined} focusable="false" {...rest}>
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}

const CATEGORY_ICONS = {
  'criminal-law': 'gavel', 'family-law': 'users', 'property-and-land-disputes': 'home', 'business-and-commercial-law': 'building',
  'employment-and-labor-law': 'briefcase', 'civil-disputes': 'scale', 'contract-disputes': 'handshake', 'immigration-law': 'passport', 'other-legal-issues': 'document',
};
/** Icon for a legal category slug (falls back to a document). */
export function CategoryIcon({ slug, className }) {
  return <Icon name={CATEGORY_ICONS[slug] ?? 'document'} className={className} />;
}

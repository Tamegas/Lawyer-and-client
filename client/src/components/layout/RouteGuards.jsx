import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { roleHome } from '../../lib/labels.js';
import { PageLoader } from '../ui/Feedback.jsx';

/** Route wrapper: signed-in only (optionally limited to `roles`). Wrong role → the person's own dashboard. Authorisation is still enforced by the API. */
export function RequireAuth({ roles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome[user.role] ?? '/'} replace />;
  return <Outlet />;
}

/** Login/register pages bounce signed-in people to where they were going (or their dashboard). */
export function RedirectIfSignedIn({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <PageLoader />;
  if (user) return <Navigate to={location.state?.from || roleHome[user.role] || '/'} replace />;
  return children;
}

import { Link } from 'react-router-dom';
import { Alert, Loadable } from '../../components/ui/Feedback.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, PageHeader, Stat } from '../../components/ui/Primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/usePage.js';
import { formatDateTime } from '../../lib/format.js';
import { MODE_LABELS, appointmentStatusInfo } from '../../lib/labels.js';

export default function ClientOverview() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/me/dashboard');
  const s = data?.stats;
  const up = data?.upcomingAppointments ?? [];
  const empty = s && !s.openRequests && !s.activeConversations && !s.savedLawyers;
  return (
    <>
      <PageHeader title={`Welcome, ${user?.fullName?.split(' ')[0] ?? ''}`} description="Your requests, conversations, quotations and appointments in one place." actions={<Button to="/describe-problem" variant="gold">Describe a legal problem</Button>} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Open requests" value={s?.openRequests ?? 0} icon="file-text" />
          <Stat label="Conversations" value={s?.activeConversations ?? 0} icon="message" />
          <Stat label="Quotations to review" value={s?.quotationsAwaitingResponse ?? 0} icon="coins" />
          <Stat label="Upcoming appointments" value={s?.upcomingAppointments ?? 0} icon="calendar" />
          <Stat label="Saved lawyers" value={s?.savedLawyers ?? 0} icon="heart" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card><h2 className="text-lg font-semibold">Next steps</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {s?.quotationsAwaitingResponse ? <li><Link to="/client/quotations?status=proposed" className="font-medium underline">Review {s.quotationsAwaitingResponse} fee proposal{s.quotationsAwaitingResponse > 1 ? 's' : ''}</Link></li> : null}
              {up[0] ? <li>Your next appointment: <Link to="/client/appointments" className="font-medium underline">{up[0].lawyerName}, {formatDateTime(up[0].startsAt)}</Link></li> : null}
              {empty ? <li><Link to="/describe-problem" className="font-medium underline">Describe your legal problem</Link> to get suggestions, or <Link to="/lawyers" className="font-medium underline">browse lawyers</Link>.</li> : null}
              <li><Link to="/fee-assistant" className="underline">Prepare questions about fees</Link></li>
            </ul></Card>
          <Card><h2 className="text-lg font-semibold">Upcoming appointments</h2>
            {up.length ? <ul className="mt-3 divide-y divide-navy-100 text-sm">{up.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span><Link to={`/lawyers/${a.lawyerSlug}`} className="font-medium underline">{a.lawyerName}</Link><span className="block text-navy-600">{formatDateTime(a.startsAt)} · {MODE_LABELS[a.mode] ?? a.mode}</span></span><StatusBadge info={appointmentStatusInfo(a.status)} /></li>))}</ul>
              : <p className="mt-3 text-sm text-navy-700">No upcoming appointments.</p>}</Card>
        </div>
      </Loadable>
      <Alert className="mt-6" tone="info">This platform does not give legal advice. It helps you find and talk to legal professionals.</Alert>
    </>
  );
}

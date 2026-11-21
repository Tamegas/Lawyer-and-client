import { Link } from 'react-router-dom';
import { formatFee, joinList, plural } from '../../lib/format.js';
import { verificationInfo } from '../../lib/labels.js';
import { Badge, StatusBadge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Stars } from '../ui/Stars.jsx';
import { Avatar } from './Avatar.jsx';

/**
 * <LawyerCard lawyer={mapCard shape} matchReasons={string[]} footer={node} />
 * "Verified" is shown only when verificationStatus === 'verified'; the rating only when real reviews exist.
 */
export function LawyerCard({ lawyer, matchReasons, footer }) {
  const verified = lawyer.verificationStatus === 'verified';
  const profile = `/lawyers/${lawyer.slug}`;
  return (
    <article className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-100 transition-shadow hover:shadow-lift">
      <div className="flex gap-4">
        <Avatar name={lawyer.name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-lg font-semibold text-navy-950"><Link to={profile} className="!text-navy-950 hover:underline">{lawyer.name}</Link></h3>
          <p className="text-sm text-navy-700">{lawyer.title || 'Legal professional'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge info={verificationInfo(lawyer.verificationStatus)} />
            {lawyer.isDemo ? <Badge tone="gold" title="This is a fictional person used to demonstrate the product.">Demo profile · fictional</Badge> : null}
            {lawyer.acceptingNewClients ? null : <Badge>Not taking new clients</Badge>}
          </div>
        </div>
      </div>

      {matchReasons?.length ? (
        <ul className="mt-3 space-y-1 rounded-lg bg-gold-50 p-3 text-xs text-gold-900">
          {matchReasons.map((r) => <li key={r} className="flex gap-1.5"><Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{r}</li>)}
        </ul>
      ) : null}

      <dl className="mt-4 space-y-2 text-sm text-navy-800">
        <div className="flex gap-2"><dt className="sr-only">Specialisations</dt><Icon name="briefcase" className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" /><dd>{lawyer.specializations?.length ? joinList(lawyer.specializations.map((s) => s.name)) : 'No practice areas listed yet'}</dd></div>
        <div className="flex gap-2"><dt className="sr-only">Experience</dt><Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" /><dd>{lawyer.yearsExperience != null ? `${plural(lawyer.yearsExperience, 'year')} of experience` : 'Experience not stated'}</dd></div>
        <div className="flex gap-2"><dt className="sr-only">Location</dt><Icon name="map-pin" className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" /><dd>{lawyer.location?.name ?? 'Location not stated'}</dd></div>
        <div className="flex gap-2"><dt className="sr-only">Languages</dt><Icon name="globe" className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" /><dd>{lawyer.languages?.length ? joinList(lawyer.languages) : 'Languages not stated'}</dd></div>
      </dl>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-navy-100 pt-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-navy-600">Consultation fee</p>
          <p className="font-serif text-lg font-semibold text-navy-950">{formatFee(lawyer.consultationFee, lawyer.currency)}</p>
        </div>
        <div className="text-right text-sm">
          {lawyer.rating ? <Stars value={lawyer.rating.average} count={lawyer.rating.count} size="sm" /> : <span className="text-navy-600">No reviews yet</span>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button to={profile} variant="secondary" size="sm" className="flex-1">View Profile</Button>
        <Button to={`${profile}?action=contact`} variant="primary" size="sm" className="flex-1">Contact Lawyer</Button>
      </div>
      {footer ? <div className="mt-3">{footer}</div> : null}
      {verified ? null : <p className="mt-3 text-xs text-navy-600">Credentials have not been verified on this platform.</p>}
    </article>
  );
}

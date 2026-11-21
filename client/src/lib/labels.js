// Human labels for the enum values stored in the database (keys are the real enum values from 001_init.sql).
// Each *Info(key) returns { label, tone, hint? }; tone is one of neutral | info | success | warning | danger | gold.
const make = (map) => (key) => map[key] ?? { label: String(key ?? '—').replace(/_/g, ' '), tone: 'neutral' };

export const verificationInfo = make({
  unverified: { label: 'Not verified', tone: 'neutral', hint: 'This lawyer has not been through our verification review.' },
  pending: { label: 'Verification pending', tone: 'warning', hint: 'Documents were submitted and are waiting for an administrator.' },
  verified: { label: 'Verified', tone: 'success', hint: 'An administrator reviewed this professional’s credentials.' },
  rejected: { label: 'Not verified', tone: 'neutral', hint: 'This lawyer has not been verified.' },
});
export const profileStatusInfo = make({
  draft: { label: 'Draft — not public', tone: 'neutral' }, published: { label: 'Published', tone: 'success' }, suspended: { label: 'Suspended', tone: 'danger' },
});
export const quotationStatusInfo = make({
  requested: { label: 'Waiting for the lawyer', tone: 'info' }, proposed: { label: 'Proposal received', tone: 'gold' },
  revision_requested: { label: 'Revision requested', tone: 'warning' }, accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' }, withdrawn: { label: 'Withdrawn by the lawyer', tone: 'neutral' },
});
export const quotationStatusForLawyer = make({
  requested: { label: 'Needs your proposal', tone: 'warning' }, proposed: { label: 'Proposal sent', tone: 'info' },
  revision_requested: { label: 'Revision requested', tone: 'warning' }, accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' }, withdrawn: { label: 'You withdrew it', tone: 'neutral' },
});
export const appointmentStatusInfo = make({
  requested: { label: 'Requested', tone: 'warning' }, confirmed: { label: 'Confirmed', tone: 'success' }, declined: { label: 'Declined', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' }, completed: { label: 'Completed', tone: 'info' },
});
export const requestStatusInfo = make({ open: { label: 'Open', tone: 'info' }, closed: { label: 'Closed', tone: 'neutral' } });
export const applicationStatusInfo = make({
  submitted: { label: 'Waiting for review', tone: 'warning' }, more_info_requested: { label: 'More information requested', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' }, rejected: { label: 'Not approved', tone: 'danger' }, withdrawn: { label: 'Withdrawn', tone: 'neutral' },
});
export const credentialStatusInfo = make({
  pending: { label: 'Pending review', tone: 'warning' }, verified: { label: 'Reviewed — accepted', tone: 'success' }, rejected: { label: 'Not accepted', tone: 'danger' },
});
export const reportStatusInfo = make({ open: { label: 'Open', tone: 'warning' }, resolved: { label: 'Resolved', tone: 'success' }, dismissed: { label: 'Dismissed', tone: 'neutral' } });
export const contentStatusInfo = make({
  pending: { label: 'Awaiting review', tone: 'warning' }, published: { label: 'Published', tone: 'success' }, hidden: { label: 'Hidden', tone: 'neutral' }, rejected: { label: 'Rejected', tone: 'danger' },
});
export const accountStatusInfo = make({ active: { label: 'Active', tone: 'success' }, suspended: { label: 'Suspended', tone: 'danger' }, deleted: { label: 'Closed', tone: 'neutral' } });
export const evidenceInfo = make({
  lawyer_claim: { label: 'Lawyer-submitted claim', tone: 'neutral', hint: 'Written by the lawyer. Not independently checked.' },
  public_reference: { label: 'Public reference cited', tone: 'info', hint: 'The lawyer cited a public reference. We have not checked it.' },
  verified_document: { label: 'Checked by an administrator', tone: 'success', hint: 'An administrator compared this with a document or public source.' },
});

export const HELP_TYPE_LABELS = {
  consultation: 'A consultation', representation: 'Representation in a case', document_review: 'Reviewing a document',
  document_drafting: 'Drafting a document', mediation: 'Mediation or negotiation', general_information: 'General information',
};
export const CONSULT_PREFERENCE_LABELS = { online: 'Online', in_person: 'In person', either: 'Either is fine' };
export const MODE_LABELS = { online: 'Online', in_person: 'In person' };
export const FEE_TYPE_LABELS = { fixed: 'Fixed fee', hourly: 'Hourly rate', itemized: 'Itemised fees' };
export const REPORT_REASON_LABELS = {
  misleading: 'Misleading or false information', impersonation: 'Impersonation', inappropriate: 'Inappropriate content',
  confidential_info: 'Shares confidential information', abusive: 'Abusive or harassing', spam: 'Spam', other: 'Something else',
};
export const REPORT_TARGET_LABELS = { lawyer_profile: 'Lawyer profile', review: 'Review', case: 'Case summary', message: 'Message' };
export const CREDENTIAL_TYPE_LABELS = { bar_license: 'Bar licence / registration', law_degree: 'Law degree', professional_certificate: 'Professional certificate', other: 'Other document' };

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most relevant' }, { value: 'experience', label: 'Most experienced' },
  { value: 'fee_asc', label: 'Lowest consultation fee' }, { value: 'rating', label: 'Highest rated' },
];
export const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any experience' }, { value: '3', label: '3+ years' }, { value: '5', label: '5+ years' }, { value: '10', label: '10+ years' }, { value: '15', label: '15+ years' },
];
export const roleHome = { client: '/client', lawyer: '/lawyer', admin: '/admin' };

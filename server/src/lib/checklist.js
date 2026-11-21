// Profile completeness for a lawyer: what is still missing before the profile can be published.
export async function loadChecklist(db, profileId) {
  const { rows } = await db.query(
    `SELECT lp.bio, lp.qualifications, lp.location_id, lp.languages, lp.years_experience, lp.consultation_modes,
            (SELECT count(*) FROM lawyer_specializations s WHERE s.lawyer_profile_id = lp.id)::int AS specs,
            (SELECT count(*) FROM lawyer_availability a WHERE a.lawyer_profile_id = lp.id)::int AS avail
       FROM lawyer_profiles lp WHERE lp.id = $1`, [profileId]);
  const r = rows[0];
  if (!r) return [];
  return [
    { key: 'bio', label: 'Write a biography (at least 50 characters)', done: (r.bio ?? '').length >= 50, required: true },
    { key: 'location', label: 'Choose your office location', done: r.location_id != null, required: true },
    { key: 'languages', label: 'List the languages you work in', done: (r.languages ?? []).length > 0, required: true },
    { key: 'specializations', label: 'Select at least one practice area', done: r.specs > 0, required: true },
    { key: 'experience', label: 'Add your years of experience', done: r.years_experience != null, required: false },
    { key: 'qualifications', label: 'Describe your qualifications and education', done: (r.qualifications ?? '').length > 0, required: false },
    { key: 'availability', label: 'Set weekly availability so clients can request appointments', done: r.avail > 0, required: false },
  ];
}

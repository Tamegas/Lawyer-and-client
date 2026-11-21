// Ownership-checked loaders. They return null (callers answer 404) unless `user` is a participant, so a route can
// never forget the ownership check by selecting a row directly. Administrators are NOT participants in private
// conversations or quotations; they only see reported items through the admin routes.
// `db` is anything with .query(): pass { query } from ../db.js, or a transaction client.

/** Conversation + both parties' names, or null unless user is its client or its lawyer. */
export async function loadConversation(db, id, user) {
  const { rows } = await db.query(
    `SELECT c.*, lp.user_id AS lawyer_user_id, lp.slug AS lawyer_slug, lp.verification_status AS lawyer_verification_status,
            lu.full_name AS lawyer_name, cu.full_name AS client_name
       FROM conversations c
       JOIN lawyer_profiles lp ON lp.id = c.lawyer_profile_id
       JOIN users lu ON lu.id = lp.user_id
       JOIN users cu ON cu.id = c.client_id
      WHERE c.id = $1 AND (c.client_id = $2 OR lp.user_id = $2)`,
    [id, user.id],
  );
  return rows[0] ?? null;
}

/** Quotation + names, or null unless user is its client or its lawyer. */
export async function loadQuotation(db, id, user) {
  const { rows } = await db.query(
    `SELECT q.*, lp.user_id AS lawyer_user_id, lp.slug AS lawyer_slug, lu.full_name AS lawyer_name, cu.full_name AS client_name
       FROM quotations q
       JOIN lawyer_profiles lp ON lp.id = q.lawyer_profile_id
       JOIN users lu ON lu.id = lp.user_id
       JOIN users cu ON cu.id = q.client_id
      WHERE q.id = $1 AND (q.client_id = $2 OR lp.user_id = $2)`,
    [id, user.id],
  );
  return rows[0] ?? null;
}

/** Appointment + names, or null unless user is its client or its lawyer. */
export async function loadAppointment(db, id, user) {
  const { rows } = await db.query(
    `SELECT a.*, lp.user_id AS lawyer_user_id, lp.slug AS lawyer_slug, lp.timezone AS lawyer_timezone,
            lu.full_name AS lawyer_name, cu.full_name AS client_name
       FROM appointments a
       JOIN lawyer_profiles lp ON lp.id = a.lawyer_profile_id
       JOIN users lu ON lu.id = lp.user_id
       JOIN users cu ON cu.id = a.client_id
      WHERE a.id = $1 AND (a.client_id = $2 OR lp.user_id = $2)`,
    [id, user.id],
  );
  return rows[0] ?? null;
}

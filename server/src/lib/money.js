const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Server-side total for a fee proposal. The client may show a preview, but this is the authority.
 *   fixed    -> fixedAmount (items, if any, are only a breakdown and are not added)
 *   hourly   -> hourlyRate x estimatedHours (no estimate when hours are not given: total is null)
 *   itemized -> sum of the items (at least one required)
 * Returns { total, error }. `error` is a message for the offending field.
 */
export function computeTotal({ feeType, fixedAmount, hourlyRate, estimatedHours, items = [] }) {
  if (feeType === 'fixed') {
    if (fixedAmount == null) return { total: null, error: 'Enter the fixed amount' };
    return { total: round2(fixedAmount), error: null };
  }
  if (feeType === 'hourly') {
    if (hourlyRate == null) return { total: null, error: 'Enter the hourly rate' };
    return { total: estimatedHours != null ? round2(hourlyRate * estimatedHours) : null, error: null };
  }
  if (feeType === 'itemized') {
    if (!items.length) return { total: null, error: 'Add at least one item' };
    return { total: round2(items.reduce((sum, item) => sum + item.amount, 0)), error: null };
  }
  return { total: null, error: 'Choose a fee type' };
}

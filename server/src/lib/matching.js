/**
 * Rank candidate lawyer cards (already filtered to published profiles in the right category) against what a
 * client asked for. This only ORGANISES suggestions with plain-language reasons; it is not legal advice and says
 * nothing about the chance of any outcome. Verified lawyers get a small, disclosed nudge — never a requirement.
 */
export function rankMatches(criteria, cards, limit = 10) {
  const ranked = cards.map((card) => {
    let score = 10; // same category (caller filtered on it)
    const reasons = ['Practises in the category you chose'];

    if (criteria.locationId && card.location?.id === criteria.locationId) {
      score += 4; reasons.push('Based in the area you chose');
    }
    if (criteria.preferredLanguage && card.languages.some((l) => l.toLowerCase() === criteria.preferredLanguage.toLowerCase())) {
      score += 4; reasons.push(`Speaks ${criteria.preferredLanguage}`);
    }
    const pref = criteria.consultationPreference;
    if (pref && pref !== 'either' && card.consultationModes.includes(pref)) {
      score += 2; reasons.push(pref === 'online' ? 'Offers online consultations' : 'Offers in-person consultations');
    }
    if (criteria.budgetMax != null && card.consultationFee != null && card.consultationFee <= criteria.budgetMax) {
      score += 2; reasons.push('Listed consultation fee is within your budget');
    }
    if (card.acceptingNewClients) score += 1;
    if (card.verificationStatus === 'verified') { score += 1; reasons.push('Credentials reviewed by an administrator'); }

    return { ...card, match: { score, reasons } };
  });
  ranked.sort((a, b) => b.match.score - a.match.score || (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0) || a.name.localeCompare(b.name));
  return ranked.slice(0, limit);
}

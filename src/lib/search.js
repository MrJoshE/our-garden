/**
 * Text for matching, ignoring case and accents: "Rosé" matches "rose".
 * @param {string} text
 */
function fold(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * True when every word of the search appears in the plant's names, variety,
 * location or tags.
 * @param {Record<string, any>} plant
 * @param {string} search
 */
export function plantMatches(plant, search) {
  const words = fold(search).split(/\s+/).filter(Boolean);
  const text = fold([plant.commonName, plant.botanicalName, plant.variety, plant.location, ...(plant.tags ?? [])].filter(Boolean).join(' '));
  return words.every((word) => text.includes(word));
}

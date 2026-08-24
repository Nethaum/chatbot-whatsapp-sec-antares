export function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\ufe0f\u20e3]/g, '')
    .toLowerCase()
    .trim();
}

export function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function containsAny(text, words) {
  const normalized = normalizeText(text);
  return words.some((word) => normalized.includes(normalizeText(word)));
}

export function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

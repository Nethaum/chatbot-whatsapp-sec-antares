export function extractPhoneCandidates(value) {
  const text = String(value || '').trim();

  if (!text || /@lid\b/i.test(text)) {
    return [];
  }

  const beforeAt = text.replace(/@.+$/, '');
  const digits = beforeAt.replace(/\D/g, '');

  if (!isPlausibleBrazilPhone(digits)) {
    return [];
  }

  return [digits];
}

function isPlausibleBrazilPhone(digits) {
  const nationalDigits = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  return nationalDigits.length === 10 || nationalDigits.length === 11;
}

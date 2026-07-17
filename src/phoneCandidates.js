export function extractPhoneCandidates(value) {
  const text = String(value || '').trim();

  if (!text || /@lid\b/i.test(text)) {
    return [];
  }

  const beforeAt = text.replace(/@.+$/, '');
  const digits = beforeAt.replace(/\D/g, '');

  if (digits.length < 10 || digits.length > 13) {
    return [];
  }

  return [digits];
}

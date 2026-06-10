const timeZone = 'America/Sao_Paulo';
const dayMs = 24 * 60 * 60 * 1000;
const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function parseDateText(value, now = new Date()) {
  const text = String(value || '').trim();
  const dayOnlyMatch = text.match(/^(\d{1,2})$/);

  if (dayOnlyMatch) {
    return nextDateForDay(Number(dayOnlyMatch[1]), now);
  }

  const match = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);

  if (!match) {
    return null;
  }

  const year = match[3] ? normalizeYear(match[3]) : todayInTimeZone(now).year;

  return buildDateParts(Number(match[1]), Number(match[2]), year);
}

export function readDate(value) {
  if (value instanceof Date) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate()
    };
  }

  if (typeof value === 'number') {
    return datePartsFromUtc(new Date(Date.UTC(1899, 11, 30) + Math.round(value * dayMs)));
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

    if (match) {
      return buildDateParts(Number(match[1]), Number(match[2]), normalizeYear(match[3]));
    }
  }

  return null;
}

export function buildDateParts(day, month, year) {
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (utcDate.getUTCFullYear() !== year || utcDate.getUTCMonth() + 1 !== month || utcDate.getUTCDate() !== day) {
    return null;
  }

  return { day, month, year };
}

export function normalizeYear(value) {
  const text = String(value || '');
  return Number(text.length === 2 ? `20${text}` : text);
}

export function todayInTimeZone(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  return {
    year: Number(parts.find((part) => part.type === 'year').value),
    month: Number(parts.find((part) => part.type === 'month').value),
    day: Number(parts.find((part) => part.type === 'day').value)
  };
}

export function addMonths(date, months) {
  const result = new Date(Date.UTC(date.year, date.month - 1 + months, date.day));
  return datePartsFromUtc(result);
}

export function addDays(date, days) {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return datePartsFromUtc(result);
}

export function datePartsFromUtc(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

export function dateKey(date) {
  return date.year * 10000 + date.month * 100 + date.day;
}

export function formatDate(date) {
  return `${String(date.day).padStart(2, '0')}/${String(date.month).padStart(2, '0')}/${date.year}`;
}

export function weekdayName(date) {
  return dayNames[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()];
}

export function isWeekend(date) {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return day === 0 || day === 6;
}

function nextDateForDay(day, now) {
  const today = todayInTimeZone(now);

  for (let offset = 0; offset <= 12; offset += 1) {
    const base = addMonths({ ...today, day: 1 }, offset);
    const candidate = buildDateParts(day, base.month, base.year);

    if (candidate && dateKey(candidate) >= dateKey(today)) {
      return candidate;
    }
  }

  return null;
}

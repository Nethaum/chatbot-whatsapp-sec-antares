export function cellValue(cell) {
  const value = cell.value;

  if (value && typeof value === 'object' && 'result' in value) {
    return value.result;
  }

  return value;
}

export function cellText(cell) {
  return cellValueToText(cellValue(cell));
}

export function cellValueToText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object' && 'text' in value) {
    return String(value.text || '').replace(/\s+/g, ' ').trim();
  }

  if (typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText
      .map((part) => part.text || '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

export function compactRowText(row) {
  const values = [];

  row.eachCell((cell) => {
    const text = cellText(cell);

    if (text) {
      values.push(text);
    }
  });

  return values.join(' ');
}

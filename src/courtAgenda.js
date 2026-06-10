import ExcelJS from 'exceljs';
import { settings } from './config.js';
import { normalizeText } from './text.js';
import { downloadWorkbook } from './workbookDownloader.js';
import { cellText, cellValue } from './excelUtils.js';
import { buildDateParts, dateKey, isWeekend, normalizeYear, parseDateText, todayInTimeZone, weekdayName } from './dateUtils.js';

const courtSheetName = 'Agenda Quadra de Areia';
const weekdayStartMinutes = 15 * 60 + 30;

export async function checkCourtAvailability(dateText) {
  const requestedDate = parseDateText(dateText);

  if (!requestedDate) {
    return { status: 'invalid_date' };
  }

  if (dateKey(requestedDate) < dateKey(todayInTimeZone(new Date()))) {
    return { status: 'past_date', requestedDate };
  }

  const workbookBuffer = await downloadWorkbook(settings.courtSpreadsheetUrl);
  const slots = await readCourtSlots(workbookBuffer, requestedDate);
  const weekend = isWeekend(requestedDate);

  return {
    status: 'available',
    requestedDate,
    weekdayName: weekdayName(requestedDate),
    displayMode: weekend ? 'unavailable_only' : 'available_slots',
    availableSlots: slots.filter((slot) => slot.available).map((slot) => slot.label),
    unavailableSlots: slots.filter((slot) => !slot.available).map((slot) => slot.label)
  };
}

async function readCourtSlots(buffer, requestedDate) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet(courtSheetName);

  if (!sheet) {
    throw new Error(`Aba "${courtSheetName}" não encontrada na planilha.`);
  }

  const tableHeaders = findCourtTableHeaders(sheet);
  const weekday = normalizeText(weekdayName(requestedDate));
  const slots = [];

  for (const headerRowNumber of tableHeaders) {
    const headerRow = sheet.getRow(headerRowNumber);
    const dayRow = findWeekdayRow(sheet, headerRowNumber + 1, weekday);

    if (!dayRow) {
      continue;
    }

    for (let colNumber = 2; colNumber <= sheet.columnCount; colNumber += 1) {
      const timeRange = parseTimeRange(cellText(headerRow.getCell(colNumber)));

      if (!timeRange || (!isWeekend(requestedDate) && timeRange.startMinutes < weekdayStartMinutes)) {
        continue;
      }

      const cell = dayRow.getCell(colNumber);
      slots.push({
        label: timeRange.label,
        available: isCourtSlotAvailable(cell, requestedDate)
      });
    }
  }

  return slots;
}

function findCourtTableHeaders(sheet) {
  const headers = [];

  sheet.eachRow((row, rowNumber) => {
    const firstCell = normalizeText(cellText(row.getCell(1)));

    if (firstCell === 'dia da semana') {
      headers.push(rowNumber);
    }
  });

  return headers;
}

function findWeekdayRow(sheet, startRowNumber, weekday) {
  for (let rowNumber = startRowNumber; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const firstCell = normalizeText(cellText(row.getCell(1)));

    if (firstCell === 'obs:' || firstCell === 'dia da semana') {
      return null;
    }

    if (firstCell === weekday) {
      return row;
    }
  }

  return null;
}

function isCourtSlotAvailable(cell, requestedDate) {
  const value = cellText(cell);

  if (!value) {
    return true;
  }

  if (!isRedText(cell)) {
    return false;
  }

  const dates = extractDateMentions(value);

  if (!dates.length) {
    return false;
  }

  const todayKey = dateKey(todayInTimeZone(new Date()));

  return !dates.some((date) => dateKey(date) >= todayKey && dateKey(date) === dateKey(requestedDate));
}

function isRedText(cell) {
  const colors = [];

  if (cell.font?.color) {
    colors.push(cell.font.color);
  }

  if (cell.value && typeof cell.value === 'object' && Array.isArray(cell.value.richText)) {
    for (const part of cell.value.richText) {
      if (part.font?.color) {
        colors.push(part.font.color);
      }
    }
  }

  return colors.some(isRedColor);
}

function isRedColor(color) {
  if (!color?.argb) {
    return false;
  }

  const argb = color.argb.toUpperCase();
  return argb.endsWith('FF0000') || argb.endsWith('C00000');
}

function extractDateMentions(value) {
  const dates = [];
  const matches = String(value || '').matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g);

  for (const match of matches) {
    const year = match[3] ? normalizeYear(match[3]) : todayInTimeZone(new Date()).year;
    const date = buildDateParts(Number(match[1]), Number(match[2]), year);

    if (date) {
      dates.push(date);
    }
  }

  return dates;
}

function parseTimeRange(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(?:as|às|a)\s*(\d{1,2}):(\d{2})$/i);

  if (!match) {
    return null;
  }

  const startHours = Number(match[1]);
  const startMinutes = Number(match[2]);
  const endHours = Number(match[3]);
  const endMinutes = Number(match[4]);

  return {
    startMinutes: startHours * 60 + startMinutes,
    label: `${formatHourMinute(startHours, startMinutes)} às ${formatHourMinute(endHours, endMinutes)}`
  };
}

function formatHourMinute(hours, minutes) {
  return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`;
}

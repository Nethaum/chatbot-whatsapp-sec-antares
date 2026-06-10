import ExcelJS from 'exceljs';
import { settings } from './config.js';
import { normalizeText } from './text.js';
import { downloadWorkbook } from './workbookDownloader.js';
import { cellText, cellValue } from './excelUtils.js';
import {
  addDays,
  addMonths,
  dateKey,
  formatDate,
  parseDateText,
  readDate,
  todayInTimeZone
} from './dateUtils.js';

const agendaSheetName = 'Agenda';
const headerRowNumber = 4;
const markerColumnNumber = 3;

export async function buildEventsReply() {
  try {
    const workbookBuffer = await downloadWorkbook(settings.eventsSpreadsheetUrl);
    const events = await readPublishedEvents(workbookBuffer);

    if (!events.length) {
      return noEventsReply();
    }

    return [eventsTitle(), '', ...events.map(formatEventLine)].join('\n');
  } catch (error) {
    console.error('Erro ao atualizar agenda de eventos:', error);
    return [eventsTitle(), '', '* ⚠️ Não foi possível atualizar a agenda no momento. 🔄 Tente novamente em instantes.'].join('\n');
  }
}

export async function checkReservationAvailability(spaceName, dateText) {
  const requestedDate = parseDateText(dateText);

  if (!requestedDate) {
    return { status: 'invalid_date' };
  }

  if (dateKey(requestedDate) < dateKey(todayInTimeZone(new Date()))) {
    return { status: 'past_date', requestedDate };
  }

  const workbookBuffer = await downloadWorkbook(settings.eventsSpreadsheetUrl);
  const bookings = await readReservationBookings(workbookBuffer);

  if (!hasReservationConflict(bookings, spaceName, requestedDate)) {
    return { status: 'available', requestedDate };
  }

  const previousDate = findAvailableDate(bookings, spaceName, requestedDate, -1);
  const nextDates = findAvailableDates(bookings, spaceName, requestedDate, 1, previousDate ? 1 : 2);

  return {
    status: 'unavailable',
    requestedDate,
    previousDate,
    nextDate: nextDates[0] || null,
    suggestions: [
      previousDate ? { direction: 'previous', date: previousDate } : null,
      ...nextDates.map((date) => ({ direction: 'next', date }))
    ].filter(Boolean)
  };
}

async function readPublishedEvents(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet(agendaSheetName);

  if (!sheet) {
    throw new Error(`Aba "${agendaSheetName}" não encontrada na planilha.`);
  }

  const columns = findAgendaColumns(sheet);
  const window = getEventWindow();
  const events = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) {
      return;
    }

    const marker = cellText(row.getCell(markerColumnNumber)).toUpperCase();
    const type = cellText(row.getCell(columns.type));
    const time = formatTime(cellValue(row.getCell(columns.time)));
    const date = readDate(cellValue(row.getCell(columns.date)));

    if (marker !== 'X' || !type || !time || !date || !isWithinWindow(date, window)) {
      return;
    }

    events.push({
      date,
      time,
      type,
      space: cellText(row.getCell(columns.space))
    });
  });

  return events.sort(compareEvents);
}

async function readReservationBookings(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet(agendaSheetName);

  if (!sheet) {
    throw new Error(`Aba "${agendaSheetName}" não encontrada na planilha.`);
  }

  const columns = findAgendaColumns(sheet);
  const bookings = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) {
      return;
    }

    const date = readDate(cellValue(row.getCell(columns.date)));
    const space = cellText(row.getCell(columns.space));
    const type = cellText(row.getCell(columns.type));

    if (date && space && type) {
      bookings.push({ date, space, type });
    }
  });

  return bookings;
}

function hasReservationConflict(bookings, spaceName, date) {
  return bookings.some((booking) => {
    return dateKey(booking.date) === dateKey(date) && spaceMatches(spaceName, booking.space);
  });
}

function spaceMatches(spaceName, bookedSpace) {
  const normalizedBookedSpace = normalizeText(bookedSpace);

  if (normalizedBookedSpace.includes('todos os espacos')) {
    return true;
  }

  return reservationSpaceAliases(spaceName).some((alias) => normalizedBookedSpace.includes(alias));
}

function reservationSpaceAliases(spaceName) {
  const normalizedSpaceName = normalizeText(spaceName);

  if (normalizedSpaceName.includes('salao principal') || normalizedSpaceName.includes('salao restaurante')) {
    return ['salao principal', 'salao de festas', 'salao festas', 'salao restaurante', 'restaurante'];
  }

  if (normalizedSpaceName.includes('churrasqueira')) {
    return ['churrasqueira'];
  }

  return [normalizedSpaceName];
}

function findAvailableDate(bookings, spaceName, requestedDate, direction) {
  return findAvailableDates(bookings, spaceName, requestedDate, direction, 1)[0] || null;
}

function findAvailableDates(bookings, spaceName, requestedDate, direction, count) {
  const todayKey = dateKey(todayInTimeZone(new Date()));
  const dates = [];

  for (let weeks = 1; weeks <= 52; weeks += 1) {
    const candidate = addDays(requestedDate, direction * weeks * 7);

    if (direction < 0 && dateKey(candidate) < todayKey) {
      return dates;
    }

    if (!hasReservationConflict(bookings, spaceName, candidate)) {
      dates.push(candidate);

      if (dates.length >= count) {
        return dates;
      }
    }
  }

  return dates;
}

function findAgendaColumns(sheet) {
  const headerRow = sheet.getRow(headerRowNumber);
  const columns = {
    date: 2,
    type: null,
    time: null,
    space: 5
  };

  headerRow.eachCell((cell, colNumber) => {
    const header = normalizeText(cellText(cell));

    if (header === 'data') {
      columns.date = colNumber;
    }

    if (header === 'tipo de evento') {
      columns.type = colNumber;
    }

    if (header === 'horario') {
      columns.time = colNumber;
    }

    if (header === 'espaco reservado') {
      columns.space = colNumber;
    }
  });

  if (!columns.type || !columns.time) {
    throw new Error('Colunas "Tipo de evento" e/ou "HORÁRIO" não foram encontradas.');
  }

  return columns;
}

function formatTime(value) {
  if (value instanceof Date) {
    return formatHourMinute(value.getUTCHours(), value.getUTCMinutes());
  }

  if (typeof value === 'number') {
    const totalMinutes = Math.round((value % 1) * 24 * 60);
    return formatHourMinute(Math.floor(totalMinutes / 60), totalMinutes % 60);
  }

  return normalizeTimeText(String(value || '').replace(/\s+/g, ' ').trim());
}

function formatHourMinute(hours, minutes) {
  const formattedHours = String(hours).padStart(2, '0');

  if (!minutes) {
    return `${formattedHours}h`;
  }

  return `${formattedHours}h${String(minutes).padStart(2, '0')}min`;
}

function normalizeTimeText(value) {
  const match = value.match(/^(\d{1,2})(?::|h)(\d{2})?(?:\s*min)?$/i);

  if (!match) {
    return value;
  }

  return formatHourMinute(Number(match[1]), Number(match[2] || 0));
}

function getEventWindow(now = new Date()) {
  const today = todayInTimeZone(now);
  const end = today.month >= 10 ? addMonths(today, 3) : { year: today.year, month: 12, day: 31 };

  return {
    start: dateKey(today),
    end: dateKey(end)
  };
}

function isWithinWindow(date, window) {
  const key = dateKey(date);
  return key >= window.start && key <= window.end;
}

function compareEvents(a, b) {
  return dateKey(a.date) - dateKey(b.date) || a.time.localeCompare(b.time) || a.type.localeCompare(b.type);
}

function formatEventLine(event) {
  const space = event.space ? ` (${formatEventSpace(event.space)})` : '';
  return `* 🗓️ ${formatDate(event.date)} às 🕒 ${event.time} - ${formatEventTitle(event.type)}${space}`;
}

function formatEventTitle(title) {
  const formattedTitle = String(title || '').trim();

  if (!formattedTitle || startsWithEmoji(formattedTitle)) {
    return formattedTitle;
  }

  return `${eventEmoji(formattedTitle)} ${formattedTitle}`;
}

function eventEmoji(title) {
  const normalizedTitle = normalizeText(title);

  if (containsAnyNormalized(normalizedTitle, ['picanha', 'churrasco', 'costela', 'carne'])) {
    return '🥩';
  }

  if (containsAnyNormalized(normalizedTitle, ['vinho', 'degustacao'])) {
    return '🍷';
  }

  if (containsAnyNormalized(normalizedTitle, ['aniversario'])) {
    return '🎉';
  }

  if (containsAnyNormalized(normalizedTitle, ['formatura', 'graduacao'])) {
    return '🎓';
  }

  if (containsAnyNormalized(normalizedTitle, ['casamento'])) {
    return '💍';
  }

  if (containsAnyNormalized(normalizedTitle, ['feijoada'])) {
    return '🍲';
  }

  if (containsAnyNormalized(normalizedTitle, ['pizza', 'pizzada'])) {
    return '🍕';
  }

  if (containsAnyNormalized(normalizedTitle, ['jantar', 'almoco', 'gastronomico'])) {
    return '🍽️';
  }

  if (containsAnyNormalized(normalizedTitle, ['baile', 'danca'])) {
    return '💃';
  }

  if (containsAnyNormalized(normalizedTitle, ['show', 'musica', 'karaoke'])) {
    return '🎤';
  }

  if (containsAnyNormalized(normalizedTitle, ['torneio', 'campeonato', 'competicao'])) {
    return '🏆';
  }

  if (containsAnyNormalized(normalizedTitle, ['festa junina', 'junina', 'arraia'])) {
    return '🌽';
  }

  if (containsAnyNormalized(normalizedTitle, ['natal'])) {
    return '🎄';
  }

  if (containsAnyNormalized(normalizedTitle, ['carnaval'])) {
    return '🎭';
  }

  return '🎊';
}

function containsAnyNormalized(value, words) {
  return words.some((word) => value.includes(normalizeText(word)));
}

function startsWithEmoji(value) {
  return /^\p{Extended_Pictographic}/u.test(value.trim());
}

function formatEventSpace(space) {
  const normalizedSpace = normalizeText(space);

  if (normalizedSpace.includes('todos os espacos')) {
    return 'Todos os espaços';
  }

  if (normalizedSpace.includes('salao de festas') || normalizedSpace.includes('salao festas')) {
    return 'Salão Principal';
  }

  if (normalizedSpace.includes('salao principal')) {
    return 'Salão Principal';
  }

  if (normalizedSpace.includes('salao restaurante') || normalizedSpace === 'restaurante') {
    return 'Salão Restaurante';
  }

  if (normalizedSpace.includes('churrasqueira')) {
    return 'Churrasqueira';
  }

  if (normalizedSpace.includes('quadra de areia')) {
    return 'Quadra de Areia';
  }

  return space;
}

function eventsTitle() {
  return '🎊 Eventos';
}

function noEventsReply() {
  return [eventsTitle(), '', '* 📭 Nenhum evento programado'].join('\n');
}

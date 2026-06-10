import ExcelJS from 'exceljs';
import { settings } from './config.js';
import { normalizeText } from './text.js';
import { downloadWorkbook } from './workbookDownloader.js';
import { cellText, cellValue, cellValueToText, compactRowText } from './excelUtils.js';

const pricingSheetName = 'Tabela de Precos';

export async function buildReservationPricingText(spaceName) {
  try {
    const workbookBuffer = await downloadWorkbook(settings.pricingSpreadsheetUrl);
    const pricing = await readReservationPricing(workbookBuffer, spaceName);

    if (!pricing.rows.length) {
      return '💰 Valores: não encontrados para este ambiente.';
    }

    return formatPricing(pricing);
  } catch (error) {
    console.error('Erro ao consultar tabela de preços:', error);
    return '💰 Valores: não foi possível consultar no momento.';
  }
}

async function readReservationPricing(buffer, spaceName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = findPricingSheet(workbook);
  const sectionStartRow = findEnvironmentSectionRow(sheet, spaceName);

  if (!sectionStartRow) {
    return { rows: [], notes: [], capacity: '' };
  }

  const headerRowNumber = findTableHeaderRow(sheet, sectionStartRow + 1);

  if (!headerRowNumber) {
    return { rows: [], notes: [], capacity: '' };
  }

  const capacity = extractCapacity(compactRowText(sheet.getRow(sectionStartRow)));

  return {
    ...readPricingRows(sheet, headerRowNumber),
    capacity
  };
}

function findPricingSheet(workbook) {
  const sheet =
    workbook.getWorksheet(pricingSheetName) ||
    workbook.worksheets.find((worksheet) => normalizeText(worksheet.name).includes('tabela de precos'));

  if (!sheet) {
    throw new Error(`Aba "${pricingSheetName}" não encontrada na planilha de preços.`);
  }

  return sheet;
}

function findEnvironmentSectionRow(sheet, spaceName) {
  const aliases = environmentAliases(spaceName);
  let sectionRowNumber = null;

  sheet.eachRow((row, rowNumber) => {
    if (sectionRowNumber) {
      return;
    }

    const rowText = normalizeText(compactRowText(row));

    if (aliases.some((alias) => rowText.includes(alias))) {
      sectionRowNumber = rowNumber;
    }
  });

  return sectionRowNumber;
}

function environmentAliases(spaceName) {
  const normalizedSpaceName = normalizeText(spaceName);

  if (normalizedSpaceName.includes('salao principal')) {
    return ['salao principal'];
  }

  if (normalizedSpaceName.includes('salao restaurante')) {
    return ['salao restaurante'];
  }

  if (normalizedSpaceName.includes('churrasqueira')) {
    return ['churrasqueira'];
  }

  return [normalizedSpaceName];
}

function findTableHeaderRow(sheet, startRowNumber) {
  for (let rowNumber = startRowNumber; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const text = normalizeText(compactRowText(row));

    if (text.includes('valor') && (text.includes('evento') || text.includes('tipo de evento'))) {
      return rowNumber;
    }

    if (isAnotherEnvironmentHeader(text)) {
      return null;
    }
  }

  return null;
}

function readPricingRows(sheet, headerRowNumber) {
  const columns = findPricingColumns(sheet.getRow(headerRowNumber));
  const rows = [];
  const notes = new Set();

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const rowText = normalizeText(compactRowText(row));

    if (!rowText || isAnotherEnvironmentHeader(rowText)) {
      break;
    }

    const eventType = cellText(row.getCell(columns.event));
    const value = formatMoney(cellValue(row.getCell(columns.value)));
    const cleaningFee = columns.cleaning ? formatMoney(cellValue(row.getCell(columns.cleaning))) : '';
    const note = columns.note ? cellText(row.getCell(columns.note)) : '';

    if (!eventType || (!value && !cleaningFee)) {
      continue;
    }

    if (note) {
      notes.add(note);
    }

    rows.push({ eventType, value, cleaningFee });
  }

  return { rows, notes: [...notes] };
}

function findPricingColumns(headerRow) {
  const columns = {
    event: 1,
    value: 2,
    cleaning: null,
    note: null
  };

  headerRow.eachCell((cell, colNumber) => {
    const header = normalizeText(cellText(cell));

    if (header.includes('evento')) {
      columns.event = colNumber;
    }

    if (header === 'valor') {
      columns.value = colNumber;
    }

    if (header.includes('taxa de limpeza')) {
      columns.cleaning = colNumber;
    }

    if (header === 'obs' || header.includes('observacao')) {
      columns.note = colNumber;
    }
  });

  return columns;
}

function formatPricing(pricing) {
  const lines = [];

  if (pricing.capacity) {
    lines.push(`👥 Lotação: ${pricing.capacity}`, '');
  }

  lines.push('💰 Valores:', ...pricing.rows.map((row) => `• ${formatEventType(row.eventType)}: ${formatPricingRow(row)}`));

  const note = formatPricingNote(pricing);

  if (note) {
    lines.push('', note);
  }

  return lines.join('\n');
}

function extractCapacity(value) {
  const match = String(value || '').match(/\((\s*\d+\s*pessoas?\s*)\)/i);

  if (!match) {
    return '';
  }

  return match[1].replace(/\s+/g, ' ').trim();
}

function formatEventType(eventType) {
  return `${eventTypeEmoji(eventType)} ${eventType}`;
}

function eventTypeEmoji(eventType) {
  const normalizedEventType = normalizeText(eventType);

  if (normalizedEventType.includes('casamento')) {
    return '💍';
  }

  if (normalizedEventType.includes('formatura')) {
    return '🎓';
  }

  if (normalizedEventType.includes('aniversario')) {
    return '🎉';
  }

  if (normalizedEventType.includes('socio')) {
    return '🧾';
  }

  if (normalizedEventType.includes('evento')) {
    return '🎊';
  }

  return '📌';
}

function formatPricingNote(pricing) {
  const hasCleaningFee = pricing.rows.some((row) => row.cleaningFee);
  const hasCleaningNote = pricing.notes.some((note) => normalizeText(note).includes('limpeza'));

  if (hasCleaningFee || hasCleaningNote) {
    return '🧹 A taxa de limpeza é válida para antes e após o evento';
  }

  if (pricing.notes.length === 1) {
    return `ℹ️ ${pricing.notes[0]}`;
  }

  return '';
}

function formatPricingRow(row) {
  const parts = [];

  if (row.value) {
    parts.push(row.value);
  }

  if (row.cleaningFee) {
    parts.push(`taxa de limpeza ${row.cleaningFee}`);
  }

  return parts.join(' + ');
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  return cellValueToText(value);
}

function isAnotherEnvironmentHeader(rowText) {
  return rowText.includes('salao principal') || rowText.includes('salao restaurante') || rowText.includes('churrasqueira');
}

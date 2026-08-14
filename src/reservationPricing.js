import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { rootPath, settings } from './config.js';
import { normalizeText } from './text.js';
import { downloadWorkbook } from './workbookDownloader.js';
import { cellText, cellValue, cellValueToText, compactRowText } from './excelUtils.js';

const pricingSheetName = 'Tabela de Precos';
const pricingFallbackPath = rootPath('data', 'pricing-fallback.json');

// Valores conferidos manualmente em 09/08/2026, usados quando a planilha
// online estiver indisponível. São atualizados automaticamente sempre que
// a planilha volta a responder (ver savePricingFallback).
const seedPricingFallback = {
  'Salão Principal': {
    capacity: '400 pessoas',
    rows: [
      { eventType: 'Casamentos / Eventos', value: '*R$ 1.620,00*', cleaningFee: '*R$ 350,00*' },
      { eventType: 'Aniversários', value: '*R$ 810,00*', cleaningFee: '*R$ 350,00*' },
      { eventType: 'Sócios', value: '*R$ 0,00*', cleaningFee: '*R$ 350,00*' }
    ],
    notes: []
  },
  'Salão Restaurante': {
    capacity: '120 pessoas',
    rows: [
      { eventType: 'Casamentos', value: '*R$ 950,00*', cleaningFee: '*R$ 200,00*' },
      { eventType: 'Aniversários / Eventos', value: '*R$ 400,00*', cleaningFee: '*R$ 200,00*' },
      { eventType: 'Sócios', value: '*R$ 0,00*', cleaningFee: '*R$ 200,00*' }
    ],
    notes: []
  },
  Churrasqueira: {
    capacity: '80 pessoas',
    rows: [
      { eventType: 'Aniversários / Eventos', value: '*R$ 750,00*', cleaningFee: '*R$ 200,00*' },
      { eventType: 'Sócios', value: '*R$ 0,00*', cleaningFee: '*R$ 150,00*' }
    ],
    notes: []
  }
};

export async function buildReservationPricingText(spaceName) {
  try {
    const workbookBuffer = await downloadWorkbook(settings.pricingSpreadsheetUrl);
    const pricing = await readReservationPricing(workbookBuffer, spaceName);

    if (!pricing.rows.length) {
      return '💰 Valores: não encontrados para este ambiente.';
    }

    savePricingFallback(spaceName, pricing);
    return formatPricing(pricing);
  } catch (error) {
    console.error('Erro ao consultar tabela de preços:', error);
    return buildFallbackPricingText(spaceName);
  }
}

function buildFallbackPricingText(spaceName) {
  const fallback = loadPricingFallback()[spaceName];

  if (!fallback?.rows?.length) {
    return '💰 Valores: não foi possível consultar no momento.';
  }

  console.warn(`Planilha de preços indisponível. Usando valores salvos localmente para "${spaceName}".`);
  return formatPricing(fallback);
}

function loadPricingFallback() {
  try {
    return JSON.parse(fs.readFileSync(pricingFallbackPath, 'utf8'));
  } catch {
    return seedPricingFallback;
  }
}

function savePricingFallback(spaceName, pricing) {
  try {
    const current = loadPricingFallback();

    current[spaceName] = {
      capacity: pricing.capacity,
      rows: pricing.rows,
      notes: pricing.notes,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(pricingFallbackPath, `${JSON.stringify(current, null, 2)}\n`);
  } catch (error) {
    console.warn('Não foi possível salvar os valores de reserva localmente:', error?.message || error);
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
  const money = moneyText(value);

  return money ? bold(money) : '';
}

function moneyText(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number') {
    return normalizeCurrencySpacing(new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value));
  }

  return normalizeCurrencySpacing(cellValueToText(value));
}

function bold(value) {
  return `*${value}*`;
}

function normalizeCurrencySpacing(value) {
  return String(value || '').replace(/\u00a0/g, ' ');
}

function isAnotherEnvironmentHeader(rowText) {
  return rowText.includes('salao principal') || rowText.includes('salao restaurante') || rowText.includes('churrasqueira');
}

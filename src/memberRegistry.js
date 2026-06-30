import ExcelJS from 'exceljs';
import fs from 'node:fs/promises';
import { rootPath, settings } from './config.js';
import { cellText } from './excelUtils.js';
import { normalizeText } from './text.js';
import { downloadWorkbook } from './workbookDownloader.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const LOCAL_CACHE_TTL_MS = 60 * 60 * 1000;
const WARNING_TTL_MS = 10 * 60 * 1000;
const HEADER_SCAN_LIMIT = 20;
const localMembersPath = rootPath('data', 'members.json');
const localMemberOverridesPath = rootPath('data', 'members.overrides.json');

let cachedRegistry;
let activeRegistryLoad;
let lastWarningAt = 0;

const phoneHeaderWords = [
  'telefone',
  'telefone celular',
  'celular',
  'whatsapp',
  'whats',
  'fone',
  'contato',
  'numero',
  'numero telefone',
  'numero celular',
  'nro',
  'tel'
];

const dddHeaderWords = [
  'ddd',
  'codigo de area',
  'cod area',
  'area'
];

const nameHeaderWords = [
  'nome',
  'nome completo',
  'socio',
  'socia',
  'sócio',
  'sócia',
  'associado',
  'associada',
  'titular'
];

export async function findMemberByPhone(phone) {
  const targetVariants = phoneVariants(phone);

  if (!targetVariants.size) {
    return { status: 'invalid_phone' };
  }

  const registry = await loadRegistrySafely();

  if (!registry) {
    return { status: 'unavailable' };
  }

  if (registry.source === 'disabled') {
    return { status: 'disabled' };
  }

  const member = registry.members.find((item) => intersects(item.phoneVariants, targetVariants));

  if (!member) {
    return { status: 'not_found' };
  }

  return {
    status: 'found',
    member
  };
}

export async function extractMembersFromWorkbookBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook.worksheets.flatMap(readWorksheetMembers);
}

async function loadRegistrySafely() {
  try {
    return await loadRegistry();
  } catch (error) {
    warnRegistryUnavailable(error);
    return null;
  }
}

async function loadRegistry() {
  const now = Date.now();

  if (cachedRegistry && cachedRegistry.expiresAt > now) {
    return cachedRegistry;
  }

  if (!activeRegistryLoad) {
    activeRegistryLoad = readRegistry().finally(() => {
      activeRegistryLoad = null;
    });
  }

  const registry = await activeRegistryLoad;
  cachedRegistry = {
    ...registry,
    expiresAt: registry.expiresAt || now + CACHE_TTL_MS
  };

  return cachedRegistry;
}

export async function shouldSendMemberLookupNotice() {
  if (cachedRegistry && cachedRegistry.expiresAt > Date.now()) {
    return false;
  }

  if (!settings.membersRemoteLookup || !settings.membersSpreadsheetUrl) {
    return false;
  }

  return !(await localRegistryExists());
}

async function localRegistryExists() {
  try {
    await fs.access(localMembersPath);
    return true;
  } catch {
    return false;
  }
}

async function readRegistry() {
  const localRegistry = await readLocalRegistry();
  const overridesRegistry = await readLocalOverridesRegistry();

  if (localRegistry || overridesRegistry) {
    return combineLocalRegistries(localRegistry, overridesRegistry);
  }

  if (!settings.membersRemoteLookup || !settings.membersSpreadsheetUrl) {
    return {
      source: 'disabled',
      members: []
    };
  }

  const members = await extractMembersFromWorkbookBuffer(await downloadWorkbook(settings.membersSpreadsheetUrl));

  return {
    source: 'spreadsheet',
    members
  };
}

async function readLocalRegistry() {
  return readLocalMembersFile(localMembersPath, 'local');
}

async function readLocalOverridesRegistry() {
  return readLocalMembersFile(localMemberOverridesPath, 'local-overrides');
}

async function readLocalMembersFile(filePath, source) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    const members = Array.isArray(parsed) ? parsed : parsed.members;

    if (!Array.isArray(members)) {
      throw new Error('Formato inválido. Use { "members": [...] }.');
    }

    return {
      source,
      members: members.map(normalizeLocalMember).filter((member) => member.phoneVariants.size),
      expiresAt: Date.now() + LOCAL_CACHE_TTL_MS
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw new Error(`Não foi possível ler ${filePath}. ${error.message}`);
  }
}

function combineLocalRegistries(...registries) {
  const availableRegistries = registries.filter(Boolean);

  return {
    source: availableRegistries.map((registry) => registry.source).join('+'),
    members: availableRegistries.flatMap((registry) => registry.members),
    expiresAt: Math.min(...availableRegistries.map((registry) => registry.expiresAt))
  };
}

function normalizeLocalMember(member) {
  const phones = Array.isArray(member.phones)
    ? member.phones
    : [member.phone, member.whatsapp, member.telefone, member.celular].filter(Boolean);

  return {
    name: member.name || member.nome || '',
    phoneVariants: new Set(phones.flatMap((phone) => [...phoneVariants(phone)])),
    source: 'local'
  };
}

function readWorksheetMembers(worksheet) {
  const header = findHeader(worksheet);

  if (!header) {
    return [];
  }

  const members = [];

  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const phones = extractRowPhones(row, header);
    const variants = new Set(phones.flatMap((phone) => [...phoneVariants(phone)]));

    if (!variants.size) {
      continue;
    }

    members.push({
      name: firstFilledCellText(row, header.nameColumns),
      phones,
      worksheet: worksheet.name,
      rowNumber,
      phoneVariants: variants
    });
  }

  return members;
}

function findHeader(worksheet) {
  const lastRow = Math.min(worksheet.rowCount, HEADER_SCAN_LIMIT);

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const dddColumns = [];
    const phoneColumns = [];
    const nameColumns = [];

    row.eachCell((cell, columnNumber) => {
      const headerText = normalizeText(cellText(cell));

      if (matchesHeader(headerText, phoneHeaderWords)) {
        phoneColumns.push(columnNumber);
      }

      if (matchesHeader(headerText, dddHeaderWords)) {
        dddColumns.push(columnNumber);
      }

      if (matchesHeader(headerText, nameHeaderWords)) {
        nameColumns.push(columnNumber);
      }
    });

    if (phoneColumns.length) {
      return {
        rowNumber,
        dddColumns,
        phoneColumns,
        nameColumns
      };
    }
  }

  return null;
}

function extractRowPhones(row, header) {
  const ddds = header.dddColumns.flatMap((column) => extractDdds(cellText(row.getCell(column))));
  const phones = header.phoneColumns.flatMap((column) => extractPhones(cellText(row.getCell(column))));
  const combinedPhones = [];

  for (const phone of phones) {
    combinedPhones.push(phone);

    const digits = onlyDigits(phone);

    if ((digits.length === 8 || digits.length === 9) && ddds.length) {
      combinedPhones.push(...ddds.map((ddd) => `${ddd}${digits}`));
    }
  }

  return uniqueValues(combinedPhones);
}

function matchesHeader(headerText, words) {
  if (!headerText) {
    return false;
  }

  return words.some((word) => headerText === normalizeText(word) || headerText.includes(normalizeText(word)));
}

function extractDdds(value) {
  return uniqueValues(
    String(value || '')
      .match(/\d{2}/g) || []
  );
}

function firstFilledCellText(row, columns) {
  for (const column of columns) {
    const value = cellText(row.getCell(column));

    if (value) {
      return value;
    }
  }

  return '';
}

function extractPhones(value) {
  const matches = String(value || '').match(/\+?\d[\d\s().-]{7,}\d/g) || [];

  if (matches.length) {
    return uniqueValues(matches);
  }

  const digits = onlyDigits(value);
  return digits.length >= 8 ? [digits] : [];
}

export function phoneVariants(value) {
  const rawDigits = onlyDigits(String(value || '').replace(/@.+$/, ''));
  const variants = new Set();

  addBrazilPhoneVariants(variants, rawDigits);

  return variants;
}

function addBrazilPhoneVariants(variants, rawDigits) {
  if (!rawDigits) {
    return;
  }

  const defaultDdd = normalizeDdd(settings.defaultPhoneDdd);

  if ((rawDigits.length === 8 || rawDigits.length === 9) && defaultDdd) {
    addBrazilPhoneVariants(variants, `${defaultDdd}${rawDigits}`);
  }

  const withoutCountry = rawDigits.startsWith('55') && rawDigits.length > 11 ? rawDigits.slice(2) : rawDigits;

  addPhoneVariant(variants, withoutCountry);
  addPhoneVariant(variants, withBrazilCountryCode(withoutCountry));

  if (withoutCountry.length === 10) {
    const withNinthDigit = `${withoutCountry.slice(0, 2)}9${withoutCountry.slice(2)}`;
    addPhoneVariant(variants, withNinthDigit);
    addPhoneVariant(variants, withBrazilCountryCode(withNinthDigit));
  }

  if (withoutCountry.length === 11 && withoutCountry[2] === '9') {
    const withoutNinthDigit = `${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`;
    addPhoneVariant(variants, withoutNinthDigit);
    addPhoneVariant(variants, withBrazilCountryCode(withoutNinthDigit));
  }
}

function withBrazilCountryCode(value) {
  return value.startsWith('55') ? value : `55${value}`;
}

function addPhoneVariant(variants, value) {
  const digits = onlyDigits(value);

  if (digits.length >= 8) {
    variants.add(digits);
  }
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeDdd(value) {
  const digits = onlyDigits(value);
  return digits.length === 2 ? digits : '';
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function intersects(left, right) {
  for (const item of left) {
    if (right.has(item)) {
      return true;
    }
  }

  return false;
}

function warnRegistryUnavailable(error) {
  const now = Date.now();

  if (now - lastWarningAt < WARNING_TTL_MS) {
    return;
  }

  lastWarningAt = now;
  console.warn(`Não foi possível consultar a lista de sócios. O atendimento seguirá normalmente. ${error.message}`);
}

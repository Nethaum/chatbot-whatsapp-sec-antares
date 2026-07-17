import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { rootPath, settings } from './config.js';
import { cellText } from './excelUtils.js';
import { normalizeText, uniqueValues } from './text.js';
import { downloadWorkbook } from './workbookDownloader.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const LOCAL_CACHE_TTL_MS = 60 * 60 * 1000;
const WARNING_TTL_MS = 10 * 60 * 1000;
const HEADER_SCAN_LIMIT = 20;
const HOLDER_ROW_MIN_FILL_MATCHES = 3;
const localMembersIndexPath = rootPath('data', 'members.index.json');
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
  'nome de socio',
  'nome de sócio',
  'nome do socio',
  'nome do sócio',
  'associado',
  'associada'
];

const holderFillThemes = new Set(['8']);
const holderFillColors = new Set([
  'B7DEE8',
  'C5D9F1',
  'DDEBF7',
  'DAEEF3',
  'CCFFFF',
  '9CC2E5'
]);

export async function findMemberByPhone(phone) {
  const targetVariants = phoneTargetVariants(phone);

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

  const member = registry.members.find((item) => memberMatchesPhone(item, targetVariants));

  if (!member) {
    return { status: 'not_found' };
  }

  return {
    status: 'found',
    member
  };
}

function phoneTargetVariants(phone) {
  const phones = Array.isArray(phone) ? phone : [phone];
  return new Set(phones.flatMap((item) => [...phoneLookupKeys(item)]));
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

async function readRegistry() {
  const localIndexRegistry = await readLocalIndexRegistry();
  const localRegistry = await readLocalRegistry();
  const overridesRegistry = await readLocalOverridesRegistry();

  if (localIndexRegistry || localRegistry || overridesRegistry) {
    return combineLocalRegistries(overridesRegistry, localIndexRegistry, localRegistry);
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

async function readLocalIndexRegistry() {
  try {
    const content = await fs.readFile(localMembersIndexPath, 'utf8');
    const parsed = JSON.parse(content);
    const entries = Array.isArray(parsed) ? parsed : parsed.entries;

    if (!Array.isArray(entries)) {
      throw new Error('Formato inválido. Use { "entries": [...] }.');
    }

    return {
      source: 'local-index',
      members: entries.map(normalizeLocalIndexEntry).filter((member) => member.name && member.phoneHashes.size),
      expiresAt: Date.now() + LOCAL_CACHE_TTL_MS
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw new Error(`Não foi possível ler ${localMembersIndexPath}. ${error.message}`);
  }
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
    isHolder: Boolean(member.isHolder || member.holder || member.titular),
    worksheet: member.worksheet || member.sheet || '',
    category: member.category || '',
    source: 'local'
  };
}

function normalizeLocalIndexEntry(entry) {
  return {
    name: decodeIndexText(entry.name),
    phoneHashes: new Set([entry.key].filter(Boolean)),
    isHolder: Boolean(entry.holder || entry.isHolder || entry.titular),
    worksheet: decodeIndexText(entry.sheet || entry.worksheet),
    category: decodeIndexText(entry.category),
    source: 'local-index'
  };
}

function decodeIndexText(value) {
  try {
    return Buffer.from(String(value || ''), 'base64').toString('utf8').trim();
  } catch {
    return '';
  }
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
      category: worksheetCategory(worksheet.name),
      isHolder: isHolderRow(row, header),
      rowNumber,
      phoneVariants: variants
    });
  }

  return members;
}

function worksheetCategory(worksheetName) {
  const name = normalizeText(worksheetName);

  if (name.includes('desistente')) {
    return 'desistente';
  }

  if (name.includes('patrimonial')) {
    return 'patrimonial';
  }

  if (name.includes('contribuinte')) {
    return 'contribuinte';
  }

  if (name.includes('diretoria')) {
    return 'diretoria';
  }

  return '';
}

function isHolderRow(row, header) {
  if (header.nameColumns.some((column) => cellHasHolderFill(row.getCell(column)))) {
    return true;
  }

  return rowHolderFillCount(row) >= HOLDER_ROW_MIN_FILL_MATCHES;
}

function rowHolderFillCount(row) {
  let count = 0;

  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cellHasHolderFill(cell)) {
      count += 1;
    }
  });

  return count;
}

function cellHasHolderFill(cell) {
  const color = cellFillColor(cell);

  if (!color) {
    return false;
  }

  if (color.theme !== undefined && holderFillThemes.has(String(color.theme))) {
    return true;
  }

  return holderFillColors.has(normalizeFillArgb(color.argb));
}

function cellFillColor(cell) {
  const fill = cell.fill;

  if (!fill || fill.type !== 'pattern') {
    return null;
  }

  return fill.fgColor || fill.bgColor || null;
}

function normalizeFillArgb(value) {
  return String(value || '')
    .replace(/^FF/i, '')
    .toUpperCase();
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
        nameColumns: resolveNameColumns(worksheet, rowNumber, nameColumns, phoneColumns, dddColumns)
      };
    }
  }

  return null;
}

function resolveNameColumns(worksheet, headerRowNumber, nameColumns, phoneColumns, dddColumns) {
  if (nameColumns.length) {
    return nameColumns;
  }

  return inferNameColumns(worksheet, headerRowNumber, phoneColumns, dddColumns);
}

function inferNameColumns(worksheet, headerRowNumber, phoneColumns, dddColumns) {
  const scores = new Map();
  const excludedColumns = new Set([...phoneColumns, ...dddColumns]);
  const maxCandidateColumn = Math.max(1, Math.min(...phoneColumns) - 1);
  const lastRow = Math.min(worksheet.rowCount, headerRowNumber + 30);

  for (let rowNumber = headerRowNumber + 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    for (let columnNumber = 1; columnNumber <= maxCandidateColumn; columnNumber += 1) {
      if (excludedColumns.has(columnNumber)) {
        continue;
      }

      const text = cellText(row.getCell(columnNumber));

      if (looksLikePersonName(text)) {
        scores.set(columnNumber, (scores.get(columnNumber) || 0) + 1);
      }
    }
  }

  const [bestColumn, bestScore] = [...scores].sort((left, right) => right[1] - left[1])[0] || [];
  return bestScore ? [bestColumn] : [];
}

function looksLikePersonName(value) {
  const text = String(value || '').trim();

  if (!text || /[@\d]/.test(text) || text.length > 80) {
    return false;
  }

  const words = text.match(/\p{L}{2,}/gu) || [];
  return words.length >= 2;
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

  for (const candidate of phoneDigitCandidates(rawDigits)) {
    addBrazilPhoneVariants(variants, candidate);
  }

  return variants;
}

export function phoneLookupKeys(value) {
  return new Set(
    [
      ...[...phoneVariants(value)].filter(phoneHasAreaCode),
      phoneSuffixLookupKey(value)
    ].filter(Boolean)
  );
}

export function phoneHasAreaCode(value) {
  const digits = onlyDigits(value);

  if (digits.startsWith('55')) {
    return digits.length === 12 || digits.length === 13;
  }

  return digits.length === 10 || digits.length === 11;
}

export function phoneSuffixLookupKey(value) {
  const suffix = phoneSuffix8(value);
  return suffix ? `suffix8:${suffix}` : '';
}

function phoneSuffix8(value) {
  const digits = onlyDigits(String(value || '').replace(/@.+$/, ''));
  return digits.length >= 8 ? digits.slice(-8) : '';
}

function phoneDigitCandidates(rawDigits) {
  const candidates = new Set([rawDigits]);

  addDialingPrefixCandidates(candidates, rawDigits);

  if (rawDigits.startsWith('55') && rawDigits.length > 11) {
    addDialingPrefixCandidates(candidates, rawDigits.slice(2));
  }

  return [...candidates].filter(Boolean);
}

function addDialingPrefixCandidates(candidates, digits) {
  if (!digits) {
    return;
  }

  candidates.add(digits);

  if (digits.startsWith('0')) {
    candidates.add(digits.slice(1));
  }

  // Brazil long-distance format can include 0 + carrier code + DDD + number.
  if (digits.length >= 13 && digits.startsWith('0')) {
    candidates.add(digits.slice(3));
  }
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

export function phoneHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function memberMatchesPhone(member, targetVariants) {
  if (member.phoneVariants && intersects(member.phoneVariants, targetVariants)) {
    return true;
  }

  if (!member.phoneHashes?.size) {
    return false;
  }

  for (const variant of targetVariants) {
    if (member.phoneHashes.has(phoneHash(variant))) {
      return true;
    }
  }

  return false;
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

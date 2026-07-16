import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const clubPath = path.join(rootDir, 'data', 'club.json');
const defaultEventsSpreadsheetUrl =
  'https://1drv.ms/x/c/4f4433ee4b2fea3a/IQA66i9L7jNEIIBPN2YAAAAAAVpcm1ifyE8ldoGNslNcYzc?download=1';
const contactPhoneEnvByArea = {
  secretaria: 'SECRETARIA_PHONE',
  economo: 'ECONOMO_PHONE',
  esportes: 'ESPORTES_PHONE',
  tesouraria: 'TESOURARIA_PHONE',
  social: 'SOCIAL_PHONE'
};

export const settings = {
  botName: process.env.BOT_NAME || 'Assistente do Clube',
  logMessages: process.env.LOG_MESSAGES === 'true',
  authTimeoutMs: positiveInteger(process.env.AUTH_TIMEOUT_MS, 120000),
  readyTimeoutMs: positiveInteger(process.env.READY_TIMEOUT_MS, 180000),
  sessionHealthCheckMs: positiveInteger(process.env.SESSION_HEALTH_CHECK_MS, 300000),
  reconnectDelayMs: positiveInteger(process.env.RECONNECT_DELAY_MS, 15000),
  eventsSpreadsheetUrl: process.env.EVENTS_SPREADSHEET_URL || defaultEventsSpreadsheetUrl,
  pricingSpreadsheetUrl: process.env.PRICING_SPREADSHEET_URL || process.env.EVENTS_SPREADSHEET_URL || defaultEventsSpreadsheetUrl,
  courtSpreadsheetUrl:
    process.env.COURT_SPREADSHEET_URL ||
    'https://1drv.ms/x/c/4f4433ee4b2fea3a/IQA66i9L7jNEIIBPO2YAAAAAAQMrQKACDoF8cSnU9Pimxos?download=1',
  defaultPhoneDdd: process.env.DEFAULT_PHONE_DDD || '47',
  membersRemoteLookup: process.env.MEMBERS_REMOTE_LOOKUP === 'true',
  membersSpreadsheetUrl: process.env.MEMBERS_SPREADSHEET_URL || process.env.MEMBERS_SOURCE || '',
  logsDir: path.join(rootDir, 'logs')
};

export function loadClub() {
  const raw = fs.readFileSync(clubPath, 'utf8');
  return withEnvironmentContacts(JSON.parse(raw));
}

export function rootPath(...parts) {
  return path.join(rootDir, ...parts);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function withEnvironmentContacts(club) {
  if (!Array.isArray(club.contacts)) {
    return club;
  }

  return {
    ...club,
    contacts: club.contacts.map((contact) => ({
      ...contact,
      phone: contactPhoneFromEnv(contact) || contact.phone
    }))
  };
}

function contactPhoneFromEnv(contact) {
  const key = normalizeContactArea(contact.area);
  const envName = contactPhoneEnvByArea[key];

  return envName ? process.env[envName] : '';
}

function normalizeContactArea(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

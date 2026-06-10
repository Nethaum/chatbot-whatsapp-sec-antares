import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const clubPath = path.join(rootDir, 'data', 'club.json');

export const settings = {
  botName: process.env.BOT_NAME || 'Assistente do Clube',
  respondInGroups: process.env.RESPOND_IN_GROUPS === 'true',
  groupCommandPrefix: process.env.GROUP_COMMAND_PREFIX || '!clube',
  logMessages: process.env.LOG_MESSAGES === 'true',
  authTimeoutMs: positiveInteger(process.env.AUTH_TIMEOUT_MS, 120000),
  readyTimeoutMs: positiveInteger(process.env.READY_TIMEOUT_MS, 180000),
  sessionHealthCheckMs: positiveInteger(process.env.SESSION_HEALTH_CHECK_MS, 300000),
  reconnectDelayMs: positiveInteger(process.env.RECONNECT_DELAY_MS, 15000),
  eventsSpreadsheetUrl:
    process.env.EVENTS_SPREADSHEET_URL ||
    'https://1drv.ms/x/c/4f4433ee4b2fea3a/IQA66i9L7jNEIIBPN2YAAAAAAVpcm1ifyE8ldoGNslNcYzc?download=1',
  pricingSpreadsheetUrl:
    process.env.PRICING_SPREADSHEET_URL ||
    'https://1drv.ms/x/c/ed9f8646361c61a8/IQDkkm-sBM6cRoU-3MxkA7B0AUoyOvWAN0wOYObppEYaEdc?download=1',
  courtSpreadsheetUrl:
    process.env.COURT_SPREADSHEET_URL ||
    'https://1drv.ms/x/c/4f4433ee4b2fea3a/IQA66i9L7jNEIIBPO2YAAAAAAQMrQKACDoF8cSnU9Pimxos?download=1',
  logsDir: path.join(rootDir, 'logs')
};

export function loadClub() {
  const raw = fs.readFileSync(clubPath, 'utf8');
  return JSON.parse(raw);
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

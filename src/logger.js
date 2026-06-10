import fs from 'node:fs';
import path from 'node:path';
import { settings } from './config.js';

export function logConversation(entry) {
  if (!settings.logMessages) {
    return;
  }

  fs.mkdirSync(settings.logsDir, { recursive: true });
  const filePath = path.join(settings.logsDir, 'conversations.jsonl');
  fs.appendFileSync(filePath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

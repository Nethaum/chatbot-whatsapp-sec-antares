import fs from 'node:fs/promises';
import { settings } from '../src/config.js';
import { downloadWorkbook } from '../src/workbookDownloader.js';
import { extractMembersFromWorkbookBuffer } from '../src/memberRegistry.js';

const outputPath = new URL('../data/members.json', import.meta.url);
const sourceArg = process.argv[2];
const source = sourceArg || process.env.MEMBERS_SOURCE || settings.membersSpreadsheetUrl;

if (!source) {
  console.error('Configure MEMBERS_SOURCE, MEMBERS_SPREADSHEET_URL ou informe o caminho do arquivo Excel.');
  process.exit(1);
}

const buffer = isUrl(source) ? await downloadWorkbook(source) : await fs.readFile(source);
const members = await extractMembersFromWorkbookBuffer(buffer);
const payload = {
  updatedAt: new Date().toISOString(),
  source: isUrl(source) ? 'url' : source,
  members: members.map((member) => ({
    name: member.name,
    phones: member.phones
  }))
};

await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Lista local de sócios atualizada: ${members.length} registro(s).`);

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

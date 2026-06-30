import fs from 'node:fs/promises';
import path from 'node:path';
import { settings } from '../src/config.js';
import { downloadWorkbook } from '../src/workbookDownloader.js';
import { buildIndexEntries } from '../src/memberIndex.js';
import { extractMembersFromWorkbookBuffer } from '../src/memberRegistry.js';

const outputPath = new URL('../data/members.index.json', import.meta.url);
const sourceArg = process.argv[2];
const source = sourceArg || process.env.MEMBERS_SOURCE || settings.membersSpreadsheetUrl;

if (!source) {
  console.error('Configure MEMBERS_SOURCE, MEMBERS_SPREADSHEET_URL ou informe o caminho do arquivo Excel.');
  process.exit(1);
}

try {
  const buffer = isUrl(source) ? await downloadWorkbook(source) : await fs.readFile(source);
  const members = await extractMembersFromWorkbookBuffer(buffer);
  const entries = buildIndexEntries(members);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: isUrl(source) ? 'url' : path.basename(source),
    encoding: 'sha256(phoneVariant|uniqueSuffix8)->base64(name); metadata fields are encoded when sensitive',
    entries
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Indice local de socios atualizado: ${members.length} registro(s), ${entries.length} chave(s).`);
} catch (error) {
  console.error('Nao foi possivel atualizar a lista local de socios.');
  console.error(`Fonte usada: ${source}`);
  console.error(`Erro: ${error.message}`);
  console.error('Se a fonte for um link do OneDrive, confirme se ele baixa um arquivo .xlsx direto.');
  console.error('Alternativa: baixe a planilha e rode npm.cmd run members:update -- "C:\\caminho\\lista.xlsx".');
  process.exit(1);
}

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

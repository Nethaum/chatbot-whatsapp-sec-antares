import fs from 'node:fs/promises';
import { findMemberByPhone, phoneVariants } from '../src/memberRegistry.js';

const phone = process.argv.slice(2).join(' ').trim();
const membersPath = new URL('../data/members.json', import.meta.url);

if (!phone) {
  console.error('Informe um telefone. Exemplo: npm.cmd run members:find -- "+55 47 9281-2101"');
  process.exit(1);
}

const hasLocalCache = await fileExists(membersPath);
const result = await findMemberByPhone(phone);

console.log(`Cache local: ${hasLocalCache ? 'encontrado' : 'nao encontrado'}`);
console.log(`Variantes analisadas: ${[...phoneVariants(phone)].join(', ')}`);

if (result.status === 'found') {
  console.log(`Socio encontrado: ${result.member.name || '(sem nome)'}`);
  process.exit(0);
}

console.log(`Socio nao encontrado. Status: ${result.status}`);
process.exit(result.status === 'not_found' ? 2 : 1);

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

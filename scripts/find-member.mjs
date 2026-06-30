import fs from 'node:fs/promises';
import { findMemberByPhone, phoneLookupKeys, phoneVariants } from '../src/memberRegistry.js';

const phone = process.argv.slice(2).join(' ').trim();
const indexPath = new URL('../data/members.index.json', import.meta.url);
const membersPath = new URL('../data/members.json', import.meta.url);
const overridesPath = new URL('../data/members.overrides.json', import.meta.url);

if (!phone) {
  console.error('Informe um telefone. Exemplo: npm.cmd run members:find -- "+55 47 99999-0000"');
  process.exit(1);
}

const hasEncodedIndex = await fileExists(indexPath);
const hasLocalCache = await fileExists(membersPath);
const hasLocalOverrides = await fileExists(overridesPath);
const result = await findMemberByPhone(phone);

console.log(`Indice codificado: ${hasEncodedIndex ? 'encontrado' : 'nao encontrado'}`);
console.log(`Cache legado: ${hasLocalCache ? 'encontrado' : 'nao encontrado'}`);
console.log(`Indice local: ${hasLocalOverrides ? 'encontrado' : 'nao encontrado'}`);
console.log(`Variantes analisadas: ${[...phoneVariants(phone)].join(', ')}`);
console.log(`Chaves de busca: ${[...phoneLookupKeys(phone)].join(', ')}`);

if (result.status === 'found') {
  console.log(`Socio encontrado: ${result.member.name || '(sem nome)'}`);
  console.log(`Titular: ${result.member.isHolder ? 'sim' : 'nao informado'}`);

  if (result.member.worksheet) {
    console.log(`Aba de origem: ${result.member.worksheet}`);
  }

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

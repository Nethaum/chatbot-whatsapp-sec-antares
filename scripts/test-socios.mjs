import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildIndexEntries } from '../src/memberIndex.js';
import {
  extractMembersFromWorkbookBuffer,
  phoneHash,
  phoneLookupKeys,
  phoneSuffixLookupKey,
  phoneVariants
} from '../src/memberRegistry.js';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Socios');

worksheet.addRow(['Nome', 'DDD', 'Telefone']);
worksheet.addRow(['Maria da Silva', '47', '4000-0001']);
worksheet.addRow(['João Teste', '', '99999-0000']);
worksheet.addRow(['Duplicado Um', '47', '3333-4444']);
worksheet.addRow(['Duplicado Dois', '48', '3333-4444']);

const mergedHeaderWorksheet = workbook.addWorksheet('Patrimoniais');
mergedHeaderWorksheet.addRow(['TÍTULO', 'N° SÓCIO', 'GRUPO', 'CARTEIRINHA', '', 'PARENTESCO', 'NASCIMENTO', 'AQUISIÇÃO', 'CPF', 'FONE']);
const holderRow = mergedHeaderWorksheet.addRow(['3', '3', 'Sim', '', 'Titular Exemplo', '', '', '', '000.000.000-00', '47 95555-1212']);
holderRow.eachCell({ includeEmpty: true }, (cell) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { theme: 8 } };
});
mergedHeaderWorksheet.addRow(['3', '3-1', '', '', 'Dependente Teste', 'Filho', '', '', '', '47 96666-3434']);

const members = await extractMembersFromWorkbookBuffer(await workbook.xlsx.writeBuffer());
const maria = members.find((member) => member.name === 'Maria da Silva');
const joao = members.find((member) => member.name === 'João Teste');
const titular = members.find((member) => member.name === 'Titular Exemplo');
const dependente = members.find((member) => member.name === 'Dependente Teste');
const indexEntries = buildIndexEntries(members);
const indexKeys = new Set(indexEntries.map((entry) => entry.key));

assert.ok(maria);
assert.ok(joao);
assert.ok(titular);
assert.ok(dependente);
assert.ok(maria.phoneVariants.has('554740000001'));
assert.ok(maria.phoneVariants.has('5547940000001'));
assert.ok(joao.phoneVariants.has('5547999990000'));
assert.ok(titular.phoneVariants.has('5547955551212'));
assert.equal(titular.isHolder, true);
assert.equal(dependente.isHolder, false);
assert.deepEqual([...phoneVariants('+55 47 4000-0001')].sort(), [...phoneVariants('47 4000-0001')].sort());
assert.ok(indexKeys.has(phoneHash(phoneSuffixLookupKey('47 95555-1212'))));
assert.equal(indexKeys.has(phoneHash('55551212')), false);
assert.equal(indexKeys.has(phoneHash('5555551212')), false);
assert.equal(indexKeys.has(phoneHash(phoneSuffixLookupKey('47 3333-4444'))), false);
assert.equal(indexKeys.has(phoneHash('33334444')), false);
assert.equal(indexKeys.has(phoneHash('5533334444')), false);

const shortPhoneLookupKeys = phoneLookupKeys('5555-1212');
assert.ok(shortPhoneLookupKeys.has('suffix8:55551212'));
assert.ok(shortPhoneLookupKeys.has('5547955551212'));
assert.equal(shortPhoneLookupKeys.has('55551212'), false);
assert.equal(shortPhoneLookupKeys.has('5555551212'), false);

for (const phone of [
  '+55 47 5555-1212',
  '+55 47 95555-1212',
  '47 5555-1212',
  '47 95555-1212',
  '5555-1212',
  '95555-1212',
  '0 47 95555-1212',
  '015 47 95555-1212'
]) {
  const variants = phoneVariants(phone);
  assert.ok(variants.has('5547955551212'), `faltou variante com nono digito para ${phone}`);
  assert.ok(variants.has('554755551212'), `faltou variante sem nono digito para ${phone}`);
}

console.log('Normalizacao da lista de socios conferida.');

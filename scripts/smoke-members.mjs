import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { extractMembersFromWorkbookBuffer, phoneVariants } from '../src/memberRegistry.js';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Socios');

worksheet.addRow(['Nome', 'DDD', 'Telefone']);
worksheet.addRow(['Maria da Silva', '47', '9281-2101']);
worksheet.addRow(['João Teste', '', '99999-0000']);

const members = await extractMembersFromWorkbookBuffer(await workbook.xlsx.writeBuffer());
const maria = members.find((member) => member.name === 'Maria da Silva');
const joao = members.find((member) => member.name === 'João Teste');

assert.ok(maria);
assert.ok(joao);
assert.ok(maria.phoneVariants.has('554792812101'));
assert.ok(maria.phoneVariants.has('5547992812101'));
assert.ok(joao.phoneVariants.has('5547999990000'));
assert.deepEqual([...phoneVariants('+55 47 9281-2101')].sort(), [...phoneVariants('47 9281-2101')].sort());

console.log('Normalizacao da lista de socios conferida.');

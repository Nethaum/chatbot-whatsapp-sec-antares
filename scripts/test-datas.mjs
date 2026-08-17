import assert from 'node:assert/strict';
import { parseDateText } from '../src/dateUtils.js';

const referenceDate = new Date('2026-07-16T12:00:00-03:00');

assert.deepEqual(parseDateText('25 julho', referenceDate), { day: 25, month: 7, year: 2026 });
assert.deepEqual(parseDateText('25 de julho', referenceDate), { day: 25, month: 7, year: 2026 });
assert.deepEqual(parseDateText('25 jul', referenceDate), { day: 25, month: 7, year: 2026 });
assert.deepEqual(parseDateText('25 de julho de 2027', referenceDate), { day: 25, month: 7, year: 2027 });
assert.deepEqual(parseDateText('25 julho 27', referenceDate), { day: 25, month: 7, year: 2027 });
assert.deepEqual(parseDateText('25/07', referenceDate), { day: 25, month: 7, year: 2026 });
assert.deepEqual(parseDateText('30', referenceDate), { day: 30, month: 7, year: 2026 });
assert.deepEqual(parseDateText('11', referenceDate), { day: 11, month: 8, year: 2026 });
assert.equal(parseDateText('31 fevereiro', referenceDate), null);
assert.equal(parseDateText('25 ontem', referenceDate), null);
assert.deepEqual(parseDateText('dia 20 setembro', referenceDate), { day: 20, month: 9, year: 2026 });
assert.deepEqual(parseDateText('Dia 20 setembro', referenceDate), { day: 20, month: 9, year: 2026 });
assert.deepEqual(parseDateText('dia 20/09', referenceDate), { day: 20, month: 9, year: 2026 });

console.log('Datas em formato flexível conferidas.');

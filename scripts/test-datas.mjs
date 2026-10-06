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

const nov28 = { day: 28, month: 11, year: 2026 };
for (const phrase of [
  'e dia 28/11?',
  '28/11?',
  'e 28/11',
  'pro dia 28/11',
  'que tal 28/11?',
  'no dia 28/11, tem?',
  'e se for dia 28 de novembro?',
  'e 28 nov',
  'dia 28 novembro 19h',
  'Será que dia 28/11 está livre?'
]) {
  assert.deepEqual(parseDateText(phrase, referenceDate), nov28, `esperava 28/11 para "${phrase}"`);
}

assert.deepEqual(parseDateText('e dia 28', referenceDate), { day: 28, month: 7, year: 2026 });
assert.deepEqual(parseDateText('dia 25/12/2027?', referenceDate), { day: 25, month: 12, year: 2027 });
assert.equal(parseDateText('para 30 pessoas', referenceDate), null);
assert.equal(parseDateText('e quanto custa?', referenceDate), null);
assert.equal(parseDateText('às 19h', referenceDate), null);

console.log('Datas em formato flexível conferidas.');

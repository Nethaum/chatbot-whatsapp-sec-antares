import assert from 'node:assert/strict';
import { isDirectCommandInput } from '../src/replies.js';
import { normalizeText } from '../src/text.js';

for (const input of ['0', '1', '11', '15', '31', '', 'sim', 'não', 'nao', 'v', 'voltar', 'menu', 'cancelar', 'oi', 'boa noite', 'ok', '1️⃣3️⃣', '1️⃣']) {
  assert.equal(isDirectCommandInput(input), true, `esperava true para "${input}"`);
}

assert.equal(normalizeText('1️⃣3️⃣'), '13');
assert.equal(normalizeText('1️⃣'), '1');

for (const input of [
  'qual seria o valor do aluguel daquela área ali atrás, onde tem a cancha?',
  'e teria disponibilidade pro dia 22/08, 16h em diante?',
  'Mensalidade da dança',
  'Boa tarde mensalidade referente o mês de agosto já pra deixar paga obrigado',
  'gostaria de saber sobre o salão principal'
]) {
  assert.equal(isDirectCommandInput(input), false, `esperava false para "${input}"`);
}

console.log('Deteccao de comando direto conferida.');

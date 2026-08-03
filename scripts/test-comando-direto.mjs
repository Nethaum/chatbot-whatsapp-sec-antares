import assert from 'node:assert/strict';
import { isDirectCommandInput } from '../src/replies.js';

for (const input of ['0', '1', '11', '15', '31', '', 'sim', 'não', 'nao', 'v', 'voltar', 'menu', 'cancelar', 'oi', 'boa noite', 'ok']) {
  assert.equal(isDirectCommandInput(input), true, `esperava true para "${input}"`);
}

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

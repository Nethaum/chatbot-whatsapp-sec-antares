import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { isInternalContactPhone, isInternalNotificationText } from '../src/internalContacts.js';

const club = JSON.parse(await readFile(new URL('../data/club.json', import.meta.url), 'utf8'));

assert.equal(isInternalContactPhone(club, '+55 47 9767-0749'), true);
assert.equal(isInternalContactPhone(club, '554797670749@c.us'), true);
assert.equal(isInternalContactPhone(club, '97670749'), false);
assert.equal(isInternalContactPhone(club, ['244000000000000@lid', '+55 47 9928-0435']), true);
assert.equal(isInternalContactPhone(club, '+55 47 98890-6757'), false);

assert.equal(isInternalNotificationText('📌 Nova solicitação de reserva - SEC Antares'), true);
assert.equal(
  isInternalNotificationText(
    [
      '📌 Nova solicitação de reserva - SEC Antares',
      '',
      '🏷️ Ambiente: Churrasqueira',
      'Encaminhado automaticamente pelo atendimento da SEC Antares.'
    ].join('\n')
  ),
  true
);
assert.equal(isInternalNotificationText('Bom dia, gostaria de informações.'), false);

console.log('Contatos internos conferidos.');

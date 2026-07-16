import assert from 'node:assert/strict';
import { loadClub } from '../src/config.js';
import { isInternalContactPhone, isInternalNotificationText } from '../src/internalContacts.js';

const club = withTestContactPhones(loadClub());
const socialPhone = club.contacts.find((contact) => contact.area === 'Social')?.phone;
const sportsPhone = club.contacts.find((contact) => contact.area === 'Esportes')?.phone;
const socialChatId = `${String(socialPhone).replace(/\D/g, '')}@c.us`;

assert.equal(isInternalContactPhone(club, socialPhone), true);
assert.equal(isInternalContactPhone(club, socialChatId), true);
assert.equal(isInternalContactPhone(club, '90000000'), false);
assert.equal(isInternalContactPhone(club, ['244000000000000@lid', sportsPhone]), true);
assert.equal(isInternalContactPhone(club, '+55 47 90000-0000'), false);

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

function withTestContactPhones(club) {
  const phones = {
    Secretaria: '+55 47 90000-0001',
    Ecônomo: '+55 47 90000-0002',
    Esportes: '+55 47 90000-0003',
    Tesouraria: '+55 47 90000-0004',
    Social: '+55 47 90000-0005'
  };

  return {
    ...club,
    contacts: club.contacts.map((contact) => ({
      ...contact,
      phone: phones[contact.area] || contact.phone
    }))
  };
}

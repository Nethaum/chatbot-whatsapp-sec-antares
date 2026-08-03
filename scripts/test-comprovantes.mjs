import assert from 'node:assert/strict';
import { buildPaymentReceiptForwarding, isPaymentReceiptText } from '../src/replies.js';
import { loadClub } from '../src/config.js';
import { withOperationalContactPhones } from './test-helpers.mjs';

const club = withOperationalContactPhones(loadClub());

assert.equal(isPaymentReceiptText('Boa tarde mensalidade referente o mês de agosto já pra deixar paga obrigado'), true);
assert.equal(isPaymentReceiptText('Segue o comprovante do pix'), true);
assert.equal(isPaymentReceiptText('Oi, tudo bem?'), false);
assert.equal(isPaymentReceiptText(''), false);
assert.equal(isPaymentReceiptText('Mensalidade da dança'), true);

const forwarding = await buildPaymentReceiptForwarding(club, {
  chatId: 'test-receipt',
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
assert.equal(forwarding.notification.area, 'Tesouraria');
assert.ok(forwarding.notification.to);
assert.match(forwarding.notification.text, /Comprovante de pagamento recebido/);
assert.match(forwarding.notification.text, /Contato do solicitante: \+55 47 99999-0000/);
assert.doesNotMatch(forwarding.notification.text, /Mensagem do sócio/);

const forwardingWithCaption = await buildPaymentReceiptForwarding(
  club,
  {
    chatId: 'test-receipt-caption',
    userPhone: '5547999990000',
    userPhones: ['5547999990000']
  },
  'Mensalidade da dança'
);
assert.match(forwardingWithCaption.notification.text, /💬 Mensagem do sócio: "Mensalidade da dança"/);

assert.match(forwarding.successText, /Recebi seu comprovante de pagamento/);
assert.match(forwarding.successText, /Encaminhei o arquivo para a Tesouraria/);
assert.match(forwarding.failureText, /Não foi possível encaminhar/);

const clubWithoutTreasuryPhone = {
  ...club,
  contacts: club.contacts.map((contact) =>
    contact.area === 'Tesouraria' ? { ...contact, phone: 'Configurar TESOURARIA_PHONE no .env' } : contact
  )
};
const unavailableForwarding = await buildPaymentReceiptForwarding(clubWithoutTreasuryPhone, {
  chatId: 'test-receipt-missing-phone',
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
assert.equal(unavailableForwarding.notification, null);

console.log('Encaminhamento de comprovantes conferido.');

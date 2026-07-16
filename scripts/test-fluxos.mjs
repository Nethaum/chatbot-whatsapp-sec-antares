import assert from 'node:assert/strict';
import { buildPreflightReply, buildReply } from '../src/replies.js';
import { loadClub } from '../src/config.js';

const club = loadClub();

function replyText(reply) {
  return reply && typeof reply === 'object' ? reply.text : reply;
}

async function ask(input, chatId) {
  return replyText(await buildReply(input, club, { chatId }));
}

async function askAsMember(input, chatId) {
  return replyText(
    await buildReply(input, club, {
      chatId,
      memberPreflightDone: true,
      member: { name: 'Maria da Silva' }
    })
  );
}

async function askAsMemberRaw(input, chatId, context = {}) {
  return buildReply(input, club, {
    chatId,
    memberPreflightDone: true,
    member: { name: 'Maria da Silva' },
    ...context
  });
}

const mainMenu = await ask('oi', 'test-main-menu');
assert.match(mainMenu, /Bem-vindo\(a\)/);
assert.match(mainMenu, /Reservas/);
assert.match(mainMenu, /Feedback/);
assert.match(mainMenu, /Contatos/);
assert.match(mainMenu, /fase de aprimoramento/);

const memberMenu = await askAsMember('oi', 'test-member-menu');
assert.match(memberMenu, /(Bom dia|Boa tarde|Boa noite), Maria!/);
assert.doesNotMatch(memberMenu, /Maria da Silva/);

const duesMenu = await ask('3', 'test-dues');
assert.match(duesMenu, /Mensalidade/);
assert.match(duesMenu, /3️⃣1️⃣ Solicitar boleto/);
assert.match(duesMenu, /3️⃣2️⃣ Consultar situação/);
assert.match(duesMenu, /3️⃣3️⃣ Informações/);
assert.doesNotMatch(duesMenu, /wa\.me|Abrir mensagem pronta|Abrir conversa/);

const duesInfo = await ask('33', 'test-dues-info');
assert.match(duesInfo, /Vencimento/);
assert.match(duesInfo, /\*R\$ 100,00\*/);
assert.match(duesInfo, /\*R\$ 129,00\*/);
assert.match(duesInfo, /dependentes/);
assert.doesNotMatch(duesInfo, /WhatsApp:|wa\.me|Abrir mensagem pronta|Abrir conversa/);

const boletoRequest = await askAsMemberRaw('31', 'test-dues-boleto', {
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
const boletoRequestText = replyText(boletoRequest);
assert.match(boletoRequestText, /Solicitação recebida/);
assert.match(boletoRequestText, /Solicitação de boleto/);
assert.match(boletoRequestText, /Tesouraria retornará/);
assert.equal(boletoRequest.notifications?.length, 1);
assert.equal(boletoRequest.notifications[0].area, 'Tesouraria');
assert.match(boletoRequest.notifications[0].text, /Nova solicitação financeira/);
assert.match(boletoRequest.notifications[0].text, /Pedido: Solicitação de boleto/);
assert.match(boletoRequest.notifications[0].text, /Nome: Maria da Silva/);
assert.match(boletoRequest.notifications[0].text, /Contato do solicitante: \+55 47 99999-0000/);

const financialStatusRequest = await askAsMemberRaw('32', 'test-dues-status', {
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
assert.match(replyText(financialStatusRequest), /Consulta de situação financeira/);
assert.equal(financialStatusRequest.notifications?.[0]?.area, 'Tesouraria');

const handoffMenu = await ask('atendente', 'test-handoff');
assert.match(handoffMenu, /Secretaria/);
assert.match(handoffMenu, /Ecônomo/);

const addressMenu = await ask('endereço', 'test-address');
assert.match(addressMenu, /Rua Giácomo Furlani, 66/);
assert.match(addressMenu, /Rodeio/);

const contactsMenu = await ask('contatos', 'test-contacts');
assert.match(contactsMenu, /Contatos da SEC Antares/);
assert.match(contactsMenu, /Tesouraria/);
assert.match(contactsMenu, /🍽️ Ecônomo:/);
assert.match(contactsMenu, /🍽️ Ecônomo[\s\S]+🏐 Esportes[\s\S]+🗂️ Secretaria[\s\S]+🎊 Social[\s\S]+💳 Tesouraria/);

const contactsMenuByNumber = await ask('6', 'test-contacts-number');
assert.match(contactsMenuByNumber, /Contatos da SEC Antares/);
assert.match(contactsMenuByNumber, /Ecônomo/);

const instagramMenu = await ask('instagram', 'test-instagram');
assert.match(instagramMenu, /Instagram oficial/);
assert.match(instagramMenu, /sociedade_antares/);

const restaurantMenu = await ask('restaurante', 'test-restaurant');
assert.match(restaurantMenu, /Ecônomo/);
assert.match(restaurantMenu, /WhatsApp:/);
assert.doesNotMatch(restaurantMenu, /wa\.me|Abrir conversa/);

assert.equal(await ask('enviar', 'test-outside-feedback'), null);

const feedbackMenu = await ask('5', 'test-feedback');
assert.match(feedbackMenu, /Feedback/);

const feedbackDraft = await ask('Gostei do atendimento.', 'test-feedback');
assert.equal(feedbackDraft, null);

const feedbackSent = await ask('enviar', 'test-feedback');
assert.match(feedbackSent, /Mensagem recebida/);
assert.doesNotMatch(feedbackSent, /Atendimento encerrado/);

const membershipMenu = await ask('4', 'test-membership');
assert.match(membershipMenu, /Associação/);
assert.match(membershipMenu, /material de apresentação/);
assert.doesNotMatch(membershipMenu, /Identificação|Não localizei/);
assert.match(membershipMenu, /\*R\$ 2\.500,00\*/);
assert.match(membershipMenu, /\*R\$ 100,00\/mês\*/);
assert.match(membershipMenu, /\*R\$ 129,00\/mês\*/);

const unknownPreflight = await buildPreflightReply('4', {
  chatId: 'test-unidentified-membership',
  userPhone: '5547000000000'
});
assert.equal(replyText(unknownPreflight), null);

const unknownMembershipMenu = await buildReply('4', club, {
  chatId: 'test-unidentified-membership',
  userPhone: '5547000000000'
});
assert.match(replyText(unknownMembershipMenu), /Associação/);
assert.doesNotMatch(replyText(unknownMembershipMenu), /Identificação|Não localizei/);

const incompleteMembership = await ask('Fulano', 'test-membership');
assert.match(incompleteMembership, /Informações recebidas até aqui|Não consegui identificar/);
assert.match(incompleteMembership, /Telefone/);
assert.match(incompleteMembership, /Plano de interesse/);

const membershipConfirmation = await ask('(47) 99999-9999 contribuinte', 'test-membership');
assert.match(membershipConfirmation, /Deseja enviar a solicitação/);
assert.match(membershipConfirmation, /Sócio Contribuinte/);

await ask('5', 'test-empty-feedback');
const emptyFeedbackFinished = await ask('fim', 'test-empty-feedback');
assert.match(emptyFeedbackFinished, /Atendimento encerrado/);
assert.match(emptyFeedbackFinished, /\*menu\*/);

await ask('1', 'test-reservations');
const reservationFinished = await ask('fim', 'test-reservations');
assert.match(reservationFinished, /Atendimento encerrado/);

await askAsMember('1', 'test-member-reservation');
await askAsMember('11', 'test-member-reservation');
const dateConfirmation = await askAsMember('30/12/2026', 'test-member-reservation');
assert.match(dateConfirmation, /Data identificada: \*30\/12\/2026 \(Quarta-feira\)\*/);
assert.match(dateConfirmation, /Deseja seguir com essa data\?\n\n✅ Responda \*sim\*/);
assert.match(dateConfirmation, /Informe outra data para consultar/);
assert.doesNotMatch(dateConfirmation, /\*data\*/);
const memberReservationPrompt = await askAsMember('sim', 'test-member-reservation');
assert.match(memberReservationPrompt, /Nome: Maria da Silva/);
assert.match(memberReservationPrompt, /Horário de início do evento/);
assert.doesNotMatch(memberReservationPrompt, /Nome completo do responsável/);

const reservationConfirmation = await askAsMemberRaw('19h', 'test-member-reservation', {
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
const reservationConfirmationText = replyText(reservationConfirmation);
assert.match(reservationConfirmationText, /Solicitação recebida/);
assert.match(reservationConfirmationText, /Horário: 19h/);
assert.match(reservationConfirmationText, /pagamento da taxa de limpeza/);
assert.doesNotMatch(reservationConfirmationText, /wa\.me|Abrir mensagem pronta|Atendimento responsável/);
assert.equal(reservationConfirmation.notifications?.length, 1);
assert.equal(reservationConfirmation.notifications[0].area, 'Social');
assert.ok(reservationConfirmation.notifications[0].to);
assert.match(reservationConfirmation.notifications[0].text, /Nova solicitação de reserva/);
assert.match(reservationConfirmation.notifications[0].text, /SEC Antares\n\n🏷️ Ambiente/);
assert.match(reservationConfirmation.notifications[0].text, /Ambiente: Salão Principal/);
assert.match(reservationConfirmation.notifications[0].text, /Data: 30\/12\/2026 \(Quarta-feira\)/);
assert.match(reservationConfirmation.notifications[0].text, /Nome: Maria da Silva/);
assert.match(reservationConfirmation.notifications[0].text, /Horário: 19h/);
assert.match(reservationConfirmation.notifications[0].text, /Contato do solicitante: \+55 47 99999-0000/);
assert.match(reservationConfirmation.notifications[0].text, /Contato do solicitante: \+55 47 99999-0000\n\nEncaminhado/);

console.log('Fluxos essenciais conferidos.');

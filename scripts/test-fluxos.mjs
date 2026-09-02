import assert from 'node:assert/strict';
import { buildPreflightReply, buildReply, buildWaitNotice, unsupportedAudioMessage } from '../src/replies.js';
import { loadClub, settings } from '../src/config.js';
import { withOperationalContactPhones } from './test-helpers.mjs';

const club = withOperationalContactPhones(loadClub());
settings.developerPhone = '5547999990000';

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
assert.match(mainMenu, /7️⃣ Sobre o Bot/);
assert.doesNotMatch(mainMenu, /fase de aprimoramento/);

const aboutMenu = await ask('7', 'test-about-bot');
assert.match(aboutMenu, /Sobre o Bot/);
assert.match(aboutMenu, /Versão: \d+\.\d+\.\d+/);
assert.match(aboutMenu, /fase de aprimoramento/);
assert.match(aboutMenu, /7️⃣1️⃣ Falar com o Desenvolvedor/);

const developerContact = await buildReply('71', club, {
  chatId: 'test-developer-contact',
  userPhone: '5547999998888',
  userPhones: ['5547999998888']
});
assert.match(replyText(developerContact), /Contato com o Desenvolvedor/);
assert.match(replyText(developerContact), /Solicitação recebida/);
assert.match(replyText(developerContact), /O desenvolvedor entrará em contato/);
assert.equal(developerContact.notifications?.length, 1);
assert.equal(developerContact.notifications[0].area, 'Desenvolvedor');
assert.equal(developerContact.notifications[0].to, settings.developerPhone);
assert.match(developerContact.notifications[0].text, /Nova solicitação de \*Contato com o Desenvolvedor\*/);
assert.match(developerContact.notifications[0].text, /Contato do solicitante: \+55 47 99999-8888/);

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
assert.match(boletoRequest.notifications[0].text, /Nova solicitação para \*Tesouraria\*/);
assert.match(boletoRequest.notifications[0].text, /Pedido: \*Solicitação de boleto\*/);
assert.match(boletoRequest.notifications[0].text, /Nome: \*Maria da Silva\*/);
assert.match(boletoRequest.notifications[0].text, /Contato do solicitante: \+55 47 99999-0000/);

const financialStatusRequest = await askAsMemberRaw('32', 'test-dues-status', {
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
assert.match(replyText(financialStatusRequest), /Consulta de situação financeira/);
assert.equal(financialStatusRequest.notifications?.[0]?.area, 'Tesouraria');

const duesUnknownWaitNotice = buildWaitNotice('31', { chatId: 'test-dues-unknown-name' });
assert.equal(duesUnknownWaitNotice, null);

const duesNamePrompt = await buildReply('31', club, { chatId: 'test-dues-unknown-name', memberPreflightDone: true });
const duesNamePromptText = replyText(duesNamePrompt);
assert.match(duesNamePromptText, /Solicitação de boleto/);
assert.match(duesNamePromptText, /Não localizei seu cadastro/);
assert.match(duesNamePromptText, /nome completo do sócio titular/);
assert.equal(duesNamePrompt.notifications, undefined);

const duesNamedRequest = await buildReply('Carlos Eduardo Testoni', club, {
  chatId: 'test-dues-unknown-name',
  memberPreflightDone: true
});
const duesNamedRequestText = replyText(duesNamedRequest);
assert.match(duesNamedRequestText, /Solicitação recebida/);
assert.equal(duesNamedRequest.notifications?.length, 1);
assert.match(duesNamedRequest.notifications[0].text, /Nova solicitação para \*Tesouraria\*/);
assert.match(duesNamedRequest.notifications[0].text, /Pedido: \*Solicitação de boleto\*/);
assert.match(duesNamedRequest.notifications[0].text, /Nome: \*Carlos Eduardo Testoni\*/);

const duesInvalidNamePrompt = await buildReply('32', club, { chatId: 'test-dues-invalid-name', memberPreflightDone: true });
assert.match(replyText(duesInvalidNamePrompt), /nome completo do sócio titular/);
const duesInvalidNameRetry = await buildReply('ok', club, { chatId: 'test-dues-invalid-name', memberPreflightDone: true });
assert.match(replyText(duesInvalidNameRetry), /Não entendi o nome informado/);

await buildReply('31', club, { chatId: 'test-dues-back-to-menu', memberPreflightDone: true });
const duesBackToMenu = await buildReply('3', club, { chatId: 'test-dues-back-to-menu', memberPreflightDone: true });
assert.match(replyText(duesBackToMenu), /3️⃣1️⃣ Solicitar boleto/);

await buildReply('31', club, { chatId: 'test-dues-change-action', memberPreflightDone: true });
const changedDuesAction = await buildReply('32', club, { chatId: 'test-dues-change-action', memberPreflightDone: true });
assert.match(replyText(changedDuesAction), /Consulta de situação financeira/);
assert.match(replyText(changedDuesAction), /nome completo do sócio titular/);

const clubWithoutTreasuryPhone = {
  ...club,
  contacts: club.contacts.map((contact) =>
    contact.area === 'Tesouraria' ? { ...contact, phone: 'Configurar TESOURARIA_PHONE no .env' } : contact
  )
};
const unavailableTreasuryRequest = await buildReply('31', clubWithoutTreasuryPhone, {
  chatId: 'test-dues-missing-treasury-phone',
  memberPreflightDone: true,
  member: { name: 'Maria da Silva' },
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
assert.match(replyText(unavailableTreasuryRequest), /Não foi possível encaminhar/);
assert.equal(unavailableTreasuryRequest.notifications, undefined);

const clubWithoutSocialPhone = {
  ...club,
  contacts: club.contacts.map((contact) =>
    contact.area === 'Social' ? { ...contact, phone: 'Configurar SOCIAL_PHONE no .env' } : contact
  )
};

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

const outsideFeedbackReply = await ask('enviar', 'test-outside-feedback');
assert.match(outsideFeedbackReply, /Não entendi sua mensagem/);
assert.match(outsideFeedbackReply, /Escolha uma opção ou digite uma palavra‑chave/);

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
assert.match(dateConfirmation, /A data \*30\/12\/2026 \(Quarta-feira\)\* está \*disponível\*/);
assert.match(dateConfirmation, /Deseja seguir com essa data\?\n\n✅ Responda \*sim\*/);
assert.match(dateConfirmation, /Informe \*outra data\* para consultar/);
assert.doesNotMatch(dateConfirmation, /\*data\*/);
assert.match(dateConfirmation, /🆅 Voltar 🔙/);
assert.doesNotMatch(dateConfirmation, /0️⃣ Menu Principal/);
assert.doesNotMatch(dateConfirmation, /1️⃣ Reservas/);
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
assert.match(reservationConfirmation.notifications[0].text, /Nova solicitação de \*Reserva\*/);
assert.match(reservationConfirmation.notifications[0].text, /Reserva\*\n\n🏷️ Ambiente/);
assert.match(reservationConfirmation.notifications[0].text, /Ambiente: \*Salão Principal\*/);
assert.match(reservationConfirmation.notifications[0].text, /Data: \*30\/12\/2026 \(Quarta-feira\)\*/);
assert.match(reservationConfirmation.notifications[0].text, /Nome: \*Maria da Silva\*/);
assert.match(reservationConfirmation.notifications[0].text, /Horário: \*19h\*/);
assert.match(reservationConfirmation.notifications[0].text, /Contato do solicitante: \+55 47 99999-0000/);
assert.match(reservationConfirmation.notifications[0].text, /Contato do solicitante: \+55 47 99999-0000\n\nEncaminhado/);

await buildReply('1', clubWithoutSocialPhone, {
  chatId: 'test-reservation-missing-social-phone',
  memberPreflightDone: true,
  member: { name: 'Maria da Silva' }
});
await buildReply('11', clubWithoutSocialPhone, {
  chatId: 'test-reservation-missing-social-phone',
  memberPreflightDone: true,
  member: { name: 'Maria da Silva' }
});
await buildReply('30/12/2026', clubWithoutSocialPhone, {
  chatId: 'test-reservation-missing-social-phone',
  memberPreflightDone: true,
  member: { name: 'Maria da Silva' }
});
await buildReply('sim', clubWithoutSocialPhone, {
  chatId: 'test-reservation-missing-social-phone',
  memberPreflightDone: true,
  member: { name: 'Maria da Silva' }
});
const unavailableSocialForwarding = await buildReply('19h', clubWithoutSocialPhone, {
  chatId: 'test-reservation-missing-social-phone',
  memberPreflightDone: true,
  member: { name: 'Maria da Silva' },
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
assert.match(replyText(unavailableSocialForwarding), /Não foi possível encaminhar/);
assert.equal(unavailableSocialForwarding.notifications, undefined);

await ask('1', 'test-reservation-name-contamination');
await ask('13', 'test-reservation-name-contamination');
await ask('30/12/2026', 'test-reservation-name-contamination');
await ask('sim', 'test-reservation-name-contamination');
const nameWithMembershipMention = await ask('Rosalina farias\nSou socia', 'test-reservation-name-contamination');
assert.match(nameWithMembershipMention, /Nome: Rosalina farias/);
assert.doesNotMatch(nameWithMembershipMention, /Sou socia|Sou sócia/);

const timeWithExtraWords = await ask('8:30 ate umas 17:30', 'test-reservation-name-contamination');
assert.match(timeWithExtraWords, /Nome: Rosalina farias/);
assert.match(timeWithExtraWords, /Horário: 08h30min/);

await ask('1', 'test-reservation-name-time-same-message');
await ask('13', 'test-reservation-name-time-same-message');
await ask('30/12/2026', 'test-reservation-name-time-same-message');
await ask('sim', 'test-reservation-name-time-same-message');
const nameAndTimeOnSeparateLines = await ask('Welington Guthner\nInício as 9:00 am', 'test-reservation-name-time-same-message');
assert.match(nameAndTimeOnSeparateLines, /Nome: Welington Guthner/);
assert.doesNotMatch(nameAndTimeOnSeparateLines, /Início|am\b/);
assert.match(nameAndTimeOnSeparateLines, /Horário: 09h00min/);

await buildReply('1', club, { chatId: 'test-reservation-garbage-phone', userPhones: ['4668846252790'] });
await buildReply('13', club, { chatId: 'test-reservation-garbage-phone', userPhones: ['4668846252790'] });
await buildReply('30/12/2026', club, { chatId: 'test-reservation-garbage-phone', userPhones: ['4668846252790'] });
await buildReply('sim', club, { chatId: 'test-reservation-garbage-phone', userPhones: ['4668846252790'] });
await buildReply('Everton Mayer', club, { chatId: 'test-reservation-garbage-phone', userPhones: ['4668846252790'] });
const garbagePhoneConfirmation = await buildReply('15h', club, {
  chatId: 'test-reservation-garbage-phone',
  userPhones: ['4668846252790']
});
assert.match(garbagePhoneConfirmation.notifications[0].text, /Contato do solicitante: não identificado pelo WhatsApp/);
assert.doesNotMatch(garbagePhoneConfirmation.notifications[0].text, /4668846252790/);

const weddingRentalQuestion = await ask(
  'Olá bom dia\nMe chamo Jeane\nQueria ver com vocês sobre aluguel para casamento\nA data que eu preciso é 12/06/2027',
  'test-wedding-rental-question'
);
assert.match(weddingRentalQuestion, /Escolha o ambiente que deseja reservar/);

const partyAreaAvailabilityQuestion = await ask('Boa tarde! A área de festa externa está disponível dia 19/09 ?', 'test-party-area-availability');
assert.match(partyAreaAvailabilityQuestion, /Escolha o ambiente que deseja reservar/);

const upcomingEventsQuestion = await ask('Vocês têm festa esse fim de semana?', 'test-upcoming-events-question');
assert.match(upcomingEventsQuestion, /Eventos/);

const reservationsMenuWithDateChange = await ask('1', 'test-reservations-menu-datechange');
assert.match(reservationsMenuWithDateChange, /1️⃣5️⃣ Já tenho reserva e quero trocar a data/);

const dateChangeSpacePrompt = await ask('15', 'test-datechange-space');
assert.match(dateChangeSpacePrompt, /Troca de data/);
assert.match(dateChangeSpacePrompt, /Qual ambiente é a sua reserva atual/);
assert.match(dateChangeSpacePrompt, /1️⃣1️⃣ Salão Principal/);

const dateChangeInvalidSpace = await ask('99', 'test-datechange-space');
assert.match(dateChangeInvalidSpace, /Não reconheci essa opção/);

const dateChangeCancelled = await ask('cancelar', 'test-datechange-cancel');
await ask('15', 'test-datechange-cancel');
const dateChangeCancelReply = await ask('cancelar', 'test-datechange-cancel');
assert.match(dateChangeCancelReply, /Nenhuma solicitação foi enviada/);
assert.match(dateChangeCancelled, /Não entendi sua mensagem/);

await askAsMember('15', 'test-member-datechange');
const dateChangeAskDate = await askAsMember('11', 'test-member-datechange');
assert.match(dateChangeAskDate, /Informe a \*nova data desejada\*/);
assert.match(dateChangeAskDate, /🆅 Voltar 🔙/);
assert.doesNotMatch(dateChangeAskDate, /0️⃣ Menu Principal/);
assert.doesNotMatch(dateChangeAskDate, /1️⃣ Reservas/);

const dateChangeIdentified = await askAsMember('30/12/2026', 'test-member-datechange');
assert.match(dateChangeIdentified, /A nova data \*30\/12\/2026 \(Quarta-feira\)\* está \*disponível\*/);
assert.match(dateChangeIdentified, /🆅 Voltar 🔙/);
assert.doesNotMatch(dateChangeIdentified, /0️⃣ Menu Principal/);
assert.doesNotMatch(dateChangeIdentified, /1️⃣ Reservas/);

const dateChangeConfirmation = await askAsMemberRaw('sim', 'test-member-datechange', {
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
assert.match(replyText(dateChangeConfirmation), /Nova data selecionada: \*30\/12\/2026 \(Quarta-feira\)\*/);
assert.match(replyText(dateChangeConfirmation), /Nome: Maria da Silva/);
assert.match(replyText(dateChangeConfirmation), /Horário de início do evento/);

const dateChangeReceived = await askAsMemberRaw('19h', 'test-member-datechange', {
  userPhone: '5547999990000',
  userPhones: ['5547999990000']
});
const dateChangeReceivedText = replyText(dateChangeReceived);
assert.match(dateChangeReceivedText, /Solicitação de troca de data recebida/);
assert.match(dateChangeReceivedText, /🗓️ Nova data: \*30\/12\/2026 \(Quarta-feira\)\*/);
assert.doesNotMatch(dateChangeReceivedText, /🗓️ Data:/);
assert.equal(dateChangeReceived.notifications?.length, 1);
assert.equal(dateChangeReceived.notifications[0].area, 'Social');
assert.match(dateChangeReceived.notifications[0].text, /Solicitação de \*Troca de Data\*/);
assert.match(dateChangeReceived.notifications[0].text, /Ambiente: \*Salão Principal\*/);
assert.match(dateChangeReceived.notifications[0].text, /Nova data solicitada: \*30\/12\/2026 \(Quarta-feira\)\*/);
assert.match(dateChangeReceived.notifications[0].text, /Nome: \*Maria da Silva\*/);
assert.doesNotMatch(dateChangeReceived.notifications[0].text, /🗓️ Data:/);

const courtDateChangePrompt = await ask('15', 'test-court-datechange');
assert.match(courtDateChangePrompt, /Qual ambiente é a sua reserva atual/);
const courtDateChangeSelection = await ask('14', 'test-court-datechange');
assert.match(courtDateChangeSelection, /Quadra de Areia/);

const dateChangeKeyword = await ask('trocar data', 'test-datechange-keyword');
assert.match(dateChangeKeyword, /Qual ambiente é a sua reserva atual/);

assert.match(unsupportedAudioMessage(), /áudio/);

console.log('Fluxos essenciais conferidos.');

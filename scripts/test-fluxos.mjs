import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { buildPreflightReply, buildReply } from '../src/replies.js';

const club = JSON.parse(await readFile(new URL('../data/club.json', import.meta.url), 'utf8'));

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

const mainMenu = await ask('oi', 'test-main-menu');
assert.match(mainMenu, /Bem-vindo\(a\)/);
assert.match(mainMenu, /Reservas/);
assert.match(mainMenu, /Feedback/);

const memberMenu = await askAsMember('oi', 'test-member-menu');
assert.match(memberMenu, /Boa (dia|tarde|noite), Maria!/);
assert.doesNotMatch(memberMenu, /Maria da Silva/);

const duesMenu = await ask('3', 'test-dues');
assert.match(duesMenu, /Tesouraria/);
assert.match(duesMenu, /\+55 47 99767-0771/);
assert.match(duesMenu, /https:\/\/wa\.me\/5547997670771/);

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
await askAsMember('30/12/2026', 'test-member-reservation');
const memberReservationPrompt = await askAsMember('sim', 'test-member-reservation');
assert.match(memberReservationPrompt, /Nome: Maria da Silva/);
assert.match(memberReservationPrompt, /Horário de início do evento/);
assert.doesNotMatch(memberReservationPrompt, /Nome completo do responsável/);

console.log('Fluxos essenciais conferidos.');

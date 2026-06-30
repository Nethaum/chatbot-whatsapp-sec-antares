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

const mainMenu = await ask('oi', 'smoke-main-menu');
assert.match(mainMenu, /Bem-vindo\(a\)/);
assert.match(mainMenu, /Reservas/);
assert.match(mainMenu, /Feedback/);

const memberMenu = await askAsMember('oi', 'smoke-member-menu');
assert.match(memberMenu, /Boa (dia|tarde|noite), Maria!/);
assert.doesNotMatch(memberMenu, /Maria da Silva/);

const duesMenu = await ask('3', 'smoke-dues');
assert.match(duesMenu, /Tesouraria/);
assert.match(duesMenu, /\+55 47 99767-0771/);
assert.match(duesMenu, /https:\/\/wa\.me\/5547997670771/);

assert.equal(await ask('enviar', 'smoke-outside-feedback'), null);

const feedbackMenu = await ask('5', 'smoke-feedback');
assert.match(feedbackMenu, /Feedback/);

const feedbackDraft = await ask('Gostei do atendimento.', 'smoke-feedback');
assert.equal(feedbackDraft, null);

const feedbackSent = await ask('enviar', 'smoke-feedback');
assert.match(feedbackSent, /Mensagem recebida/);
assert.doesNotMatch(feedbackSent, /Atendimento encerrado/);

const membershipMenu = await ask('4', 'smoke-membership');
assert.match(membershipMenu, /Associação/);
assert.match(membershipMenu, /material de apresentação/);
assert.doesNotMatch(membershipMenu, /Identificação|Não localizei/);

const unknownPreflight = await buildPreflightReply('4', {
  chatId: 'smoke-unidentified-membership',
  userPhone: '5547000000000'
});
assert.equal(replyText(unknownPreflight), null);

const unknownMembershipMenu = await buildReply('4', club, {
  chatId: 'smoke-unidentified-membership',
  userPhone: '5547000000000'
});
assert.match(replyText(unknownMembershipMenu), /Associação/);
assert.doesNotMatch(replyText(unknownMembershipMenu), /Identificação|Não localizei/);

const incompleteMembership = await ask('Fulano', 'smoke-membership');
assert.match(incompleteMembership, /Informações recebidas até aqui|Não consegui identificar/);
assert.match(incompleteMembership, /Telefone/);
assert.match(incompleteMembership, /Plano de interesse/);

const membershipConfirmation = await ask('(47) 99999-9999 contribuinte', 'smoke-membership');
assert.match(membershipConfirmation, /Deseja enviar a solicitação/);
assert.match(membershipConfirmation, /Sócio Contribuinte/);

await ask('5', 'smoke-empty-feedback');
const emptyFeedbackFinished = await ask('fim', 'smoke-empty-feedback');
assert.match(emptyFeedbackFinished, /Atendimento encerrado/);
assert.match(emptyFeedbackFinished, /\*menu\*/);

await ask('1', 'smoke-reservations');
const reservationFinished = await ask('fim', 'smoke-reservations');
assert.match(reservationFinished, /Atendimento encerrado/);

await askAsMember('1', 'smoke-member-reservation');
await askAsMember('11', 'smoke-member-reservation');
await askAsMember('30/12/2026', 'smoke-member-reservation');
const memberReservationPrompt = await askAsMember('sim', 'smoke-member-reservation');
assert.match(memberReservationPrompt, /Nome: Maria da Silva/);
assert.match(memberReservationPrompt, /Horário de início do evento/);
assert.doesNotMatch(memberReservationPrompt, /Nome completo do responsável/);

console.log('Fluxos essenciais conferidos.');

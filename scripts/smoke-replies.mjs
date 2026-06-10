import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { buildReply } from '../src/replies.js';

const club = JSON.parse(await readFile(new URL('../data/club.json', import.meta.url), 'utf8'));

function replyText(reply) {
  return reply && typeof reply === 'object' ? reply.text : reply;
}

async function ask(input, chatId) {
  return replyText(await buildReply(input, club, { chatId }));
}

const mainMenu = await ask('oi', 'smoke-main-menu');
assert.match(mainMenu, /Bem-vindo\(a\)/);
assert.match(mainMenu, /Reservas/);
assert.match(mainMenu, /Feedback/);

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

const incompleteMembership = await ask('Amilcar', 'smoke-membership');
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

console.log('Fluxos essenciais conferidos.');

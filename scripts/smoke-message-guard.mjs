import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { shouldProcessMessage, shouldSendReply } from '../src/messageGuard.js';

const timestamp = Math.floor(Date.now() / 1000);
const runId = crypto.randomUUID();
const baseMessage = {
  from: `smoke-${runId}@c.us`,
  timestamp,
  body: 'Bom dia'
};

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    id: { _serialized: `smoke-${runId}-a` }
  }),
  true
);

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    id: { _serialized: `smoke-${runId}-b` }
  }),
  false
);

const chatId = `smoke-chat-${runId}@c.us`;
const replyText = `Resposta ${timestamp}`;
const menuText = [
  '👋 Bom dia! Bem-vindo(a) ao atendimento da SEC Antares!',
  '',
  '❓ Escolha uma opção ou digite uma palavra-chave:'
].join('\n');

assert.equal(shouldSendReply(chatId, replyText), true);
assert.equal(shouldSendReply(chatId, replyText), false);
assert.equal(shouldSendReply(chatId, `${replyText} diferente`), true);
assert.equal(shouldSendReply(chatId, menuText), true);
assert.equal(shouldSendReply(chatId, menuText), false);

console.log('Guarda contra mensagens duplicadas conferida.');

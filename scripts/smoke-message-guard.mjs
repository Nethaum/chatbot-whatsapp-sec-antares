import assert from 'node:assert/strict';
import { shouldProcessMessage, shouldSendReply } from '../src/messageGuard.js';

const timestamp = Math.floor(Date.now() / 1000);
const baseMessage = {
  from: `smoke-${process.pid}@c.us`,
  timestamp,
  body: 'Bom dia'
};

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    id: { _serialized: `smoke-${process.pid}-a` }
  }),
  true
);

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    id: { _serialized: `smoke-${process.pid}-b` }
  }),
  false
);

const chatId = `smoke-chat-${process.pid}@c.us`;
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

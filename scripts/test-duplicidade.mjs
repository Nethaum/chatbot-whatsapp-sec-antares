import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { shouldProcessMessage, shouldSendReply } from '../src/messageGuard.js';

const timestamp = 1_800_000_000;
const runId = crypto.randomUUID();
const baseMessage = {
  from: `test-${runId}@c.us`,
  timestamp,
  body: 'Bom dia'
};

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    id: { _serialized: `test-${runId}-a` }
  }),
  true
);

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    id: { _serialized: `test-${runId}-b` }
  }),
  false
);

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    timestamp: timestamp + 4,
    id: { _serialized: `test-${runId}-same-window` }
  }),
  false
);

assert.equal(
  shouldProcessMessage({
    ...baseMessage,
    timestamp: timestamp + 20,
    id: { _serialized: `test-${runId}-later` }
  }),
  true
);

const chatId = `test-chat-${runId}@c.us`;
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

import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import fs from 'node:fs';
import path from 'node:path';
import { settings, loadClub } from './config.js';
import { logConversation } from './logger.js';
import { acquireInstanceLock, shouldProcessMessage, shouldSendReply } from './messageGuard.js';
import {
  buildPaymentReceiptForwarding,
  buildPreflightReply,
  buildReply,
  buildWaitNotice,
  isDirectCommandInput,
  isPaymentReceiptText
} from './replies.js';
import { compactWhitespace, uniqueValues } from './text.js';
import { isGroupChat, isGroupChatId, isGroupMessage } from './groupPolicy.js';
import { isInternalContactPhone, isInternalNotificationText } from './internalContacts.js';
import { extractPhoneCandidates } from './phoneCandidates.js';

const { Client, LocalAuth, MessageMedia } = pkg;
const club = loadClub();
const maxStartupUnreadMessagesPerChat = 10;
const readyRecoveryDelayMs = 8000;
const unreadScanInitialDelayMs = 3000;
const unreadScanRetryDelayMs = 5000;
const maxUnreadScanAttempts = 3;
const contactLookupTimeoutMs = 1200;
const pendingReceiptMediaTtlMs = 10 * 60 * 1000;
const pendingReceiptMedia = new Map();
const receiptCandidateMessageTypes = new Set(['image', 'document', 'payment', 'order']);
const nativePaymentMessageTypes = new Set(['payment', 'order']);
const conversationBurstDebounceMs = 8000;
const pendingConversationBursts = new Map();
let startupErrorHandled = false;
let client;
let reconnectTimer;
let healthCheckTimer;
let readyTimeoutTimer;
let readyRecoveryTimer;
let starting = false;
let ready = false;

const transientBrowserErrorFragments = [
  'detached frame',
  'executioncontext',
  'execution context was destroyed',
  'isolatedworld.evaluate',
  'cdpframe.evaluate',
  'client.getchatbyid',
  'client.sendmessage',
  'cannot find context',
  'target closed',
  'session closed',
  'protocol error',
  'page has been closed',
  'navigation failed because browser has disconnected'
];

process.on('unhandledRejection', (reason) => {
  if (isAuthTimeout(reason)) {
    handleStartupError(reason);
    return;
  }

  console.error('Erro assíncrono não tratado:', reason);
});

try {
  acquireInstanceLock();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

client = createClient();
startClient().catch(handleStartupError);

function createClient() {
  const nextClient = new Client({
    authStrategy: new LocalAuth({ clientId: 'clube' }),
    authTimeoutMs: settings.authTimeoutMs,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  });

  nextClient.on('qr', (qr) => {
    console.log('\nEscaneie o QR Code abaixo pelo WhatsApp:');
    console.log('WhatsApp > Aparelhos conectados > Conectar um aparelho\n');
    qrcode.generate(qr, { small: true });
  });

  nextClient.on('authenticated', () => {
    console.log('Sessao autenticada.');
    console.log('Carregando WhatsApp Web. Aguarde o aviso de pronto antes de testar mensagens.');
    scheduleReadyRecovery();
  });

  nextClient.on('loading_screen', (percent, message) => {
    console.log(`Carregando WhatsApp Web: ${percent}%${message ? ` - ${message}` : ''}`);
  });

  nextClient.on('change_state', (state) => {
    console.log(`Estado da sessao: ${state}`);
  });

  nextClient.on('ready', () => {
    starting = false;
    ready = true;
    startupErrorHandled = false;
    stopReadyTimeout();
    stopReadyRecovery();
    console.log(`${settings.botName} pronto para atender ${club.name}.`);
    console.log('Bot em execucao. Deixe esta janela aberta para continuar atendendo.');
    startHealthCheck();
    scheduleUnreadScan();
  });

  nextClient.on('auth_failure', (message) => {
    console.error('Falha de autenticacao:', message);
  });

  nextClient.on('disconnected', (reason) => {
    starting = false;
    ready = false;
    stopReadyTimeout();
    stopReadyRecovery();
    stopHealthCheck();
    console.log('Cliente desconectado:', reason);

    if (reason === 'LOGOUT') {
      console.log('A sessao foi encerrada pelo WhatsApp. Inicie novamente para escanear um novo QR Code.');
      return;
    }

    scheduleReconnect(`desconexao: ${reason}`);
  });

  nextClient.on('message', handleMessage);

  return nextClient;
}

async function handleMessage(message) {
  try {
    if (message.fromMe || message.from === 'status@broadcast') {
      return;
    }

    if (isGroupMessage(message)) {
      console.log('Mensagem de grupo ignorada.');
      return;
    }

    const body = compactWhitespace(message.body);
    const context = await resolveIncomingMessageContext(message);
    const { chat, isGroup, chatId, userPhones } = context;

    if (isGroup) {
      console.log('Mensagem de grupo ignorada.');
      return;
    }

    if (shouldIgnoreInternalContactMessage(body, userPhones, message.from, chatId)) {
      console.log('Mensagem de contato interno ignorada.');
      return;
    }

    if (!shouldProcessMessage(message)) {
      console.log('Mensagem duplicada ignorada.');
      return;
    }

    const burstItem = { message, body, from: message.from, isGroup, chat, chatId, userPhones };

    if (!pendingConversationBursts.has(chatId) && isDirectCommandInput(body)) {
      await markChatSeen(chatId);
      await processConversationBurst([burstItem]);
      return;
    }

    queueConversationBurst(chatId, burstItem);
  } catch (error) {
    if (isTransientBrowserError(error)) {
      console.warn('WhatsApp Web falhou ao ler uma mensagem. O bot manteve a sessao ativa para evitar atraso.');
      console.warn(formatErrorForLog(error));
      return;
    }

    console.error('Erro ao responder mensagem:', error);
  }
}

function queueConversationBurst(chatId, item) {
  const existing = pendingConversationBursts.get(chatId);

  if (existing) {
    clearTimeout(existing.timer);
    existing.items.push(item);
    existing.timer = setTimeout(() => fireConversationBurst(chatId), conversationBurstDebounceMs);
    return;
  }

  pendingConversationBursts.set(chatId, {
    items: [item],
    timer: setTimeout(() => fireConversationBurst(chatId), conversationBurstDebounceMs)
  });
}

async function fireConversationBurst(chatId) {
  const burst = pendingConversationBursts.get(chatId);
  pendingConversationBursts.delete(chatId);

  if (!burst || !burst.items.length) {
    return;
  }

  try {
    await markChatSeen(chatId);
    await processConversationBurst(burst.items);
  } catch (error) {
    if (isTransientBrowserError(error)) {
      console.warn('WhatsApp Web falhou ao processar mensagens agrupadas. O bot manteve a sessao ativa para evitar atraso.');
      console.warn(formatErrorForLog(error));
      return;
    }

    console.error('Erro ao responder mensagens agrupadas:', error);
  }
}

async function processConversationBurst(items) {
  const last = items[items.length - 1];
  const { chat, chatId, userPhones, isGroup, from } = last;
  const combinedBody = compactWhitespace(items.map((item) => item.body).filter(Boolean).join('\n'));
  const receiptItems = items.filter((item) => receiptCandidateMessageTypes.has(item.message.type));

  if (receiptItems.length) {
    for (const receiptItem of receiptItems) {
      await handleBurstReceiptItem(receiptItem, combinedBody, chat, chatId, userPhones, isGroup);
    }
    return;
  }

  if (combinedBody && isPaymentReceiptText(combinedBody)) {
    const claimed = await tryClaimPendingReceipt(combinedBody, chat, chatId, userPhones, isGroup, from);

    if (claimed) {
      return;
    }
  }

  if (!combinedBody) {
    return;
  }

  await answerIncomingMessage({
    body: combinedBody,
    chat,
    chatId,
    from,
    isGroup,
    originalBody: combinedBody,
    userPhones
  });
}

async function handleBurstReceiptItem(item, combinedBody, chat, chatId, userPhones, isGroup) {
  const payload = await buildReceiptPayload(item.message);

  if (!payload) {
    return;
  }

  const caption = item.body || combinedBody;
  const shouldForwardNow = nativePaymentMessageTypes.has(item.message.type) || isPaymentReceiptText(caption);

  if (shouldForwardNow) {
    const forwarded = await forwardReceiptAndReply(chat, chatId, userPhones, payload, caption);
    logConversation({
      from: item.from,
      isGroup,
      body: item.body || '[arquivo]',
      reply: forwarded
        ? '[comprovante encaminhado para a Tesouraria]'
        : '[falha ao encaminhar comprovante para a Tesouraria]'
    });
    return;
  }

  pendingReceiptMedia.set(chatId, { ...payload, receivedAt: Date.now() });
  logConversation({
    from: item.from,
    isGroup,
    body: item.body || '[arquivo]',
    reply: '[comprovante recebido aguardando contexto de pagamento]'
  });
}

async function tryClaimPendingReceipt(caption, chat, chatId, userPhones, isGroup, from) {
  const pending = pendingReceiptMedia.get(chatId);
  pendingReceiptMedia.delete(chatId);

  if (!pending || Date.now() - pending.receivedAt > pendingReceiptMediaTtlMs) {
    return false;
  }

  const forwarded = await forwardReceiptAndReply(chat, chatId, userPhones, pending, caption);
  logConversation({
    from,
    isGroup,
    body: caption,
    reply: forwarded
      ? '[comprovante encaminhado para a Tesouraria]'
      : '[falha ao encaminhar comprovante para a Tesouraria]'
  });
  return true;
}

async function buildReceiptPayload(message) {
  if (!message.hasMedia) {
    return { message };
  }

  try {
    const media = await message.downloadMedia();
    return media ? { media } : { message };
  } catch (error) {
    console.warn('Não foi possível baixar o arquivo recebido, encaminharei a mensagem original:', error?.message || error);
    return { message };
  }
}

async function forwardReceiptAndReply(chat, chatId, userPhones, payload, caption) {
  const { notification, successText, failureText } = await buildPaymentReceiptForwarding(
    club,
    {
      chatId,
      userPhone: userPhones[0] || '',
      userPhones
    },
    caption
  );

  if (notification) {
    try {
      const tesourariaChatId = await resolveNotificationChatId(notification.to);

      if (tesourariaChatId) {
        if (payload.media) {
          await sendMessageSafely(
            createChatAdapter(tesourariaChatId, false),
            payload.media,
            { caption: notification.text },
            'comprovante de pagamento'
          );
        } else {
          await payload.message.forward(tesourariaChatId);
          await sendMessageSafely(
            createChatAdapter(tesourariaChatId, false),
            notification.text,
            undefined,
            'comprovante de pagamento (encaminhamento nativo)'
          );
        }

        await sendReply(chat, successText);
        return true;
      }

      console.warn(`Numero nao encontrado no WhatsApp para encaminhamento de comprovante: ${notification.to}`);
    } catch (error) {
      console.error(`Falha ao encaminhar comprovante para ${notification.area}:`, formatErrorForLog(error));
    }
  }

  await sendReply(chat, failureText);
  return false;
}

async function resolveIncomingMessageContext(message) {
  const fallbackChatId = getMessageChatId(message);

  try {
    const chat = await message.getChat();
    const isGroup = isGroupChat(chat);
    const chatId = chat.id?._serialized || fallbackChatId;
    const userPhones = isGroup ? [] : await resolveSenderPhoneCandidates(message, chat, isGroup);

    return {
      chat,
      isGroup,
      chatId,
      userPhones
    };
  } catch (error) {
    if (!isTransientBrowserError(error)) {
      throw error;
    }

    const isGroup = isGroupChatId(fallbackChatId);

    if (isGroup) {
      throw error;
    }

    console.warn('Chat completo indisponivel. Usando envio direto para continuar o atendimento.');

    return {
      chat: createChatAdapter(fallbackChatId, false),
      isGroup: false,
      chatId: fallbackChatId,
      userPhones: await resolveFallbackSenderPhoneCandidates(message, fallbackChatId)
    };
  }
}

function getMessageChatId(message) {
  return (
    message.from ||
    message.id?.remote ||
    message.id?._serialized?.split('_').at(-1) ||
    ''
  );
}

async function answerIncomingMessage({ body, chat, chatId, from, isGroup, originalBody, userPhones }) {
  const replyContext = {
    chatId,
    from,
    userPhone: userPhones[0] || '',
    userPhones
  };
  const preflightReply = await buildPreflightReply(body, replyContext);

  if (preflightReply) {
    await sendReply(chat, preflightReply);
    return;
  }

  const waitNotice = buildWaitNotice(body, { chatId });

  if (waitNotice) {
    await sendReply(chat, waitNotice);
  }

  const reply = await buildReply(body, club, {
    ...replyContext,
    memberPreflightDone: true
  });

  if (!reply) {
    return;
  }

  const sent = await sendReply(chat, reply);

  if (sent) {
    await sendReplyNotifications(reply);
  }

  logConversation({
    from,
    isGroup,
    body: originalBody,
    reply: formatReplyForLog(reply)
  });
}

async function processUnreadChats() {
  const unreadMessages = await readUnreadMessagesFromPage();

  if (!unreadMessages.length) {
    return;
  }

  console.log(`Verificando ${unreadMessages.length} mensagem(ns) nao lida(s).`);

  for (const message of unreadMessages) {
    await handleRecoveredUnreadMessage(message);
  }
}

async function readUnreadMessagesFromPage() {
  return client.pupPage.evaluate((messageLimit) => {
    const chatCollection = window.require?.('WAWebCollections')?.Chat;
    const chats = chatCollection?.getModelsArray?.() || [];

    return chats
      .filter((chat) => Number(chat.unreadCount) > 0 && !isGroupChat(chat))
      .flatMap((chat) => serializeUnreadMessages(chat, messageLimit));

    function isGroupChat(chat) {
      return Boolean(chat.isGroup) || /@g\.us$/i.test(String(chat.id?._serialized || ''));
    }

    function serializeUnreadMessages(chat, messageLimit) {
      const unreadCount = Number(chat.unreadCount) || 0;
      const limit = Math.max(1, Math.min(unreadCount, messageLimit));
      const messages = chat.msgs?.getModelsArray?.() || chat.msgs?._models || [];
      const incomingMessages = messages
        .filter((message) => !isFromCurrentUser(message) && message.from?._serialized !== 'status@broadcast')
        .sort((left, right) => Number(left.t || left.timestamp || 0) - Number(right.t || right.timestamp || 0));

      return incomingMessages.slice(-limit).map((message) => ({
        id: message.id?._serialized || `${chat.id?._serialized}:${message.t || message.timestamp}:${message.body || ''}`,
        chatId: chat.id?._serialized,
        chatTitle: chat.formattedTitle || chat.name || '',
        from: message.from?._serialized || chat.id?._serialized,
        body: message.body || '',
        timestamp: Number(message.t || message.timestamp || Date.now() / 1000),
        type: message.type || 'chat'
      }));
    }

    function isFromCurrentUser(message) {
      return Boolean(message.id?.fromMe ?? message.fromMe);
    }
  }, maxStartupUnreadMessagesPerChat);
}

async function handleRecoveredUnreadMessage(message) {
  if (!message.chatId || message.from === 'status@broadcast') {
    return;
  }

  const isGroup = /@g\.us$/i.test(message.chatId);

  if (isGroup || isGroupChatId(message.from)) {
    console.log('Mensagem nao lida de grupo ignorada.');
    return;
  }

  const body = compactWhitespace(message.body);
  const rawCandidates = [message.from, message.chatId, message.chatTitle];

  try {
    const contact = await withTimeout(client.getContactById(message.from || message.chatId), contactLookupTimeoutMs);
    const contactId = contact?.id?._serialized || '';
    rawCandidates.push(
      contact?.number,
      !isLidChatId(contactId) ? contact?.id?.user : null,
      contactId
    );
  } catch (error) {
    console.warn(`Não foi possível ler detalhes do contato para validar o cadastro (nao lida): ${error.message}`);
  }

  const userPhones = uniqueValues(rawCandidates.flatMap(extractPhoneCandidates));

  if (shouldIgnoreInternalContactMessage(body, userPhones, message.from, message.chatId)) {
    console.log('Mensagem nao lida de contato interno ignorada.');
    await markChatSeen(message.chatId);
    return;
  }

  const messageForGuard = {
    id: { _serialized: message.id },
    from: message.from || message.chatId,
    timestamp: message.timestamp,
    body
  };

  if (!shouldProcessMessage(messageForGuard)) {
    console.log('Mensagem nao lida duplicada ignorada.');
    return;
  }

  const chat = createChatAdapter(message.chatId, isGroup);

  await answerIncomingMessage({
    body,
    chat,
    chatId: message.chatId,
    from: message.from || message.chatId,
    isGroup,
    originalBody: body,
    userPhones
  });

  await markChatSeen(message.chatId);
}

function shouldIgnoreInternalContactMessage(body, userPhones, from, chatId) {
  if (isInternalNotificationText(body)) {
    return true;
  }

  return isInternalContactPhone(club, [userPhones, from, chatId].flat());
}

function createChatAdapter(chatId, isGroup) {
  return {
    id: {
      _serialized: chatId,
      user: chatId.replace(/@.+$/, '')
    },
    isGroup,
    sendMessage(content, options) {
      return client.sendMessage(chatId, content, options);
    }
  };
}

async function markChatSeen(chatId) {
  try {
    await client.sendSeen(chatId);
  } catch (error) {
    console.warn(`Não foi possível marcar a conversa como lida: ${error?.message || error}`);
  }
}

function scheduleUnreadScan(attempt = 1, delayMs = unreadScanInitialDelayMs) {
  setTimeout(() => {
    processUnreadChats().catch((error) => handleUnreadProcessingError(error, attempt));
  }, delayMs);
}

function handleUnreadProcessingError(error, attempt) {
  const errorDetails = formatErrorForLog(error);

  if (isTransientBrowserError(error) && attempt < maxUnreadScanAttempts) {
    console.warn(
      `WhatsApp Web ainda esta estabilizando. Nova tentativa de verificar mensagens nao lidas (${attempt + 1}/${maxUnreadScanAttempts}).`
    );
    console.warn(errorDetails);
    scheduleUnreadScan(attempt + 1, unreadScanRetryDelayMs);
    return;
  }

  console.error('Falha ao verificar mensagens nao lidas:', errorDetails);
}

async function resolveSenderPhoneCandidates(message, chat, isGroup) {
  const chatId = chat.id?._serialized || '';
  const rawCandidates = [
    isGroup ? message.author : message.from,
    !isGroup && !isLidChatId(chatId) ? chat.id?.user : null,
    !isGroup ? chatId : null,
    !isGroup ? await readChatTitle(chatId) : null
  ];

  try {
    const contact = await withTimeout(message.getContact(), contactLookupTimeoutMs);
    const contactId = contact?.id?._serialized || '';
    rawCandidates.push(
      contact?.number,
      !isLidChatId(contactId) ? contact?.id?.user : null,
      contactId
    );
  } catch (error) {
    console.warn(`Não foi possível ler detalhes do contato para validar o cadastro: ${error.message}`);
  }

  return uniqueValues(rawCandidates.flatMap(extractPhoneCandidates));
}

async function resolveFallbackSenderPhoneCandidates(message, chatId) {
  const rawCandidates = [
    message.from,
    message.author,
    message.id?.remote,
    message.id?._serialized,
    chatId,
    await readChatTitle(chatId)
  ];

  try {
    const contact = await withTimeout(message.getContact(), contactLookupTimeoutMs);
    const contactId = contact?.id?._serialized || '';
    rawCandidates.push(
      contact?.number,
      !isLidChatId(contactId) ? contact?.id?.user : null,
      contactId
    );
  } catch (error) {
    console.warn(`Não foi possível ler detalhes do contato para validar o cadastro (fallback): ${error.message}`);
  }

  return uniqueValues(rawCandidates.flatMap(extractPhoneCandidates));
}

async function readChatTitle(chatId) {
  if (!chatId || !client?.pupPage) {
    return '';
  }

  try {
    return await client.pupPage.evaluate((id) => {
      const chat = window.require?.('WAWebCollections')?.Chat?.get?.(id);
      return chat?.formattedTitle || chat?.name || '';
    }, chatId);
  } catch {
    return '';
  }
}

function isLidChatId(chatId) {
  return /@lid\b/i.test(String(chatId || ''));
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`tempo limite de ${timeoutMs}ms excedido`)), timeoutMs);
    })
  ]);
}

async function sendReply(chat, reply) {
  const chatId = chat.id?._serialized || chat.id?.user || 'unknown';

  if (typeof reply === 'string') {
    if (!shouldSendReply(chatId, reply)) {
      console.log('Resposta duplicada suprimida.');
      return false;
    }

    await sendMessageSafely(chat, reply, undefined, 'texto');
    return true;
  }

  let sent = false;

  if (reply.text) {
    if (!shouldSendReply(chatId, reply.text)) {
      console.log('Resposta duplicada suprimida.');
      return false;
    }

    await sendMessageSafely(chat, reply.text, undefined, 'texto');
    sent = true;
  }

  for (const mediaItem of reply.media || []) {
    const mediaPath = resolveMediaPath(mediaItem.path || mediaItem);

    if (!fs.existsSync(mediaPath)) {
      console.warn(`Mídia opcional não encontrada, envio ignorado sem interromper o bot: ${mediaPath}`);
      continue;
    }

    const media = MessageMedia.fromFilePath(mediaPath);
    const options = mediaItem.caption ? { caption: mediaItem.caption } : undefined;
    await sendMessageSafely(chat, media, options, `mídia ${path.basename(mediaPath)}`);
    sent = true;
  }

  return sent;
}

async function sendReplyNotifications(reply) {
  if (!reply || typeof reply !== 'object' || !Array.isArray(reply.notifications)) {
    return;
  }

  for (const notification of reply.notifications) {
    await sendInternalNotification(notification);
  }
}

async function sendInternalNotification(notification) {
  const chatId = notification?.chatId || (await resolveNotificationChatId(notification?.to));

  if (!chatId || !notification?.text) {
    return;
  }

  try {
    await sendMessageSafely(createChatAdapter(chatId, false), notification.text, undefined, 'encaminhamento interno');
  } catch (error) {
    const destination = notification.area || notification.to || chatId;
    console.error(`Falha ao encaminhar solicitação para ${destination}:`, formatErrorForLog(error));
  }
}

async function resolveNotificationChatId(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  try {
    const numberId = await client.getNumberId(digits);

    if (numberId?._serialized) {
      return numberId._serialized;
    }

    console.warn(`Numero nao encontrado no WhatsApp para encaminhamento interno: ${phone}`);
  } catch (error) {
    console.warn(`Falha ao resolver numero do WhatsApp para encaminhamento interno (${phone}):`, formatErrorForLog(error));
  }

  return phoneToPrivateChatId(phone);
}

function phoneToPrivateChatId(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `${digits}@c.us` : '';
}

async function sendMessageSafely(chat, content, options, label) {
  try {
    await chat.sendMessage(content, options);
  } catch (error) {
    if (isTransientBrowserError(error)) {
      console.error(`Falha ao enviar ${label}. A conexão será reiniciada para evitar envio duplicado.`, error?.message || error);
      scheduleReconnect(`falha ao enviar ${label}`);
    }

    throw error;
  }
}

function isTransientBrowserError(error) {
  const message = [
    error?.name,
    error?.message,
    error?.stack,
    String(error || '')
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();

  return transientBrowserErrorFragments.some((fragment) => message.includes(fragment));
}

function resolveMediaPath(mediaPath) {
  return path.isAbsolute(mediaPath) ? mediaPath : path.resolve(process.cwd(), mediaPath);
}

function formatReplyForLog(reply) {
  if (typeof reply === 'string') {
    return reply;
  }

  const media = (reply.media || []).map((item) => `[mídia: ${item.path || item}]`);
  const notifications = (reply.notifications || []).map((item) => `[encaminhamento: ${item.area || item.to}]`);
  return [reply.text, ...media, ...notifications].filter(Boolean).join('\n');
}

async function startClient() {
  if (starting) {
    return;
  }

  ready = false;
  starting = true;
  startReadyTimeout();
  await client.initialize();
}

function scheduleReadyRecovery() {
  stopReadyRecovery();

  if (ready) {
    return;
  }

  readyRecoveryTimer = setTimeout(() => {
    readyRecoveryTimer = undefined;
    recoverReadyFromSyncedPage().catch(handleReadyRecoveryError);
  }, readyRecoveryDelayMs);
}

async function recoverReadyFromSyncedPage() {
  if (ready || !starting || !client?.pupPage) {
    return;
  }

  const recovered = await client.pupPage.evaluate(async () => {
    const socket = window.require?.('WAWebSocketModel')?.Socket;
    const canRecover =
      socket?.state === 'CONNECTED' &&
      socket?.hasSynced &&
      typeof window.onAppStateHasSyncedEvent === 'function';

    if (!canRecover) {
      return false;
    }

    delete window.WWebJS;
    await window.onAppStateHasSyncedEvent();
    return true;
  });

  if (recovered) {
    console.log('Sessao conectada. Finalizando preparacao do WhatsApp Web.');
    return;
  }

  scheduleReadyRecovery();
}

function handleReadyRecoveryError(error) {
  if (isTransientBrowserError(error)) {
    console.warn('WhatsApp Web ainda nao estabilizou para concluir a preparacao.');
    scheduleReadyRecovery();
    return;
  }

  console.error('Falha ao concluir preparacao do WhatsApp Web:', formatErrorForLog(error));
}

function startReadyTimeout() {
  stopReadyTimeout();

  if (!settings.readyTimeoutMs) {
    return;
  }

  readyTimeoutTimer = setTimeout(() => {
    readyTimeoutTimer = undefined;

    if (!starting) {
      return;
    }

    console.error(
      `WhatsApp Web autenticou, mas nao ficou pronto em ${Math.round(settings.readyTimeoutMs / 1000)} segundos. Reiniciando a conexao.`
    );
    starting = false;
    scheduleReconnect('tempo limite aguardando pronto');
  }, settings.readyTimeoutMs);
}

function startHealthCheck() {
  stopHealthCheck();

  if (!settings.sessionHealthCheckMs) {
    return;
  }

  healthCheckTimer = setInterval(async () => {
    try {
      const state = await client.getState();

      if (!['CONNECTED', 'OPENING', 'PAIRING'].includes(state)) {
        console.log(`Sessao em estado ${state}. Tentando reconectar.`);
        scheduleReconnect(`estado ${state}`);
      }
    } catch (error) {
      console.error('Falha ao verificar sessao:', error?.message || error);
      scheduleReconnect('falha no health check');
    }
  }, settings.sessionHealthCheckMs);
}

function stopHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = undefined;
  }
}

function stopReadyTimeout() {
  if (readyTimeoutTimer) {
    clearTimeout(readyTimeoutTimer);
    readyTimeoutTimer = undefined;
  }
}

function stopReadyRecovery() {
  if (readyRecoveryTimer) {
    clearTimeout(readyRecoveryTimer);
    readyRecoveryTimer = undefined;
  }
}

function scheduleReconnect(reason) {
  if (reconnectTimer || starting) {
    return;
  }

  ready = false;
  console.log(`Tentando reconectar em ${Math.round(settings.reconnectDelayMs / 1000)} segundos (${reason}).`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = undefined;
    stopHealthCheck();
    stopReadyTimeout();
    stopReadyRecovery();

    try {
      await client.destroy();
    } catch {
      // A instancia pode ja ter sido destruida pela biblioteca.
    }

    client = createClient();
    startClient().catch((error) => {
      starting = false;
      console.error('Falha ao reconectar:', error?.message || error);
      scheduleReconnect('erro ao reiniciar cliente');
    });
  }, settings.reconnectDelayMs);
}

async function handleStartupError(error) {
  if (startupErrorHandled) {
    return;
  }

  startupErrorHandled = true;

  if (isAuthTimeout(error)) {
    console.error(
      [
        'Tempo de autenticacao do WhatsApp Web esgotado.',
        `O bot esperou ${Math.round(settings.authTimeoutMs / 1000)} segundos e nao conseguiu carregar a sessao.`,
        'Tente iniciar novamente com npm.cmd start e escaneie o QR Code assim que ele aparecer.',
        'Se continuar falhando, feche outras janelas do WhatsApp Web e remova a sessao salva em .wwebjs_auth\\session-clube para gerar um QR novo.'
      ].join('\n')
    );
  } else {
    console.error('Erro ao iniciar o WhatsApp Web:', error);
  }

  try {
    stopReadyTimeout();
    await client.destroy();
  } catch {
    // O cliente pode falhar antes de abrir o navegador.
  }

  process.exit(1);
}

function isAuthTimeout(error) {
  return String(error?.message || error).toLowerCase().includes('auth timeout');
}

function formatErrorForLog(error) {
  return error?.stack || error?.message || String(error);
}

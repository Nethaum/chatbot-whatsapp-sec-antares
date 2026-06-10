import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
import fs from 'node:fs';
import path from 'node:path';
import { settings, loadClub } from './config.js';
import { logConversation } from './logger.js';
import { acquireInstanceLock, shouldProcessMessage, shouldSendReply } from './messageGuard.js';
import { buildReply, buildWaitNotice } from './replies.js';
import { compactWhitespace } from './text.js';

const { Client, LocalAuth, MessageMedia } = pkg;
const club = loadClub();
let startupErrorHandled = false;
let client;
let reconnectTimer;
let healthCheckTimer;
let readyTimeoutTimer;
let starting = false;

const transientBrowserErrorFragments = [
  'detached frame',
  'execution context was destroyed',
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

function shouldAnswerGroupMessage(body) {
  if (!settings.respondInGroups) {
    return false;
  }

  return body.toLowerCase().startsWith(settings.groupCommandPrefix.toLowerCase());
}

function removeGroupPrefix(body) {
  const prefix = settings.groupCommandPrefix;

  if (body.toLowerCase().startsWith(prefix.toLowerCase())) {
    return body.slice(prefix.length).trim();
  }

  return body;
}

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
  });

  nextClient.on('loading_screen', (percent, message) => {
    console.log(`Carregando WhatsApp Web: ${percent}%${message ? ` - ${message}` : ''}`);
  });

  nextClient.on('change_state', (state) => {
    console.log(`Estado da sessao: ${state}`);
  });

  nextClient.on('ready', () => {
    starting = false;
    startupErrorHandled = false;
    stopReadyTimeout();
    console.log(`${settings.botName} pronto para atender ${club.name}.`);
    console.log('Bot em execucao. Deixe esta janela aberta para continuar atendendo.');
    startHealthCheck();
  });

  nextClient.on('auth_failure', (message) => {
    console.error('Falha de autenticacao:', message);
  });

  nextClient.on('disconnected', (reason) => {
    starting = false;
    stopReadyTimeout();
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

    const chat = await message.getChat();
    const isGroup = chat.isGroup;
    const body = compactWhitespace(message.body);

    if (isGroup && !shouldAnswerGroupMessage(body)) {
      return;
    }

    if (!shouldProcessMessage(message)) {
      console.log('Mensagem duplicada ignorada.');
      return;
    }

    const cleanBody = isGroup ? removeGroupPrefix(body) : body;
    const chatId = chat.id?._serialized || message.from;
    const waitNotice = buildWaitNotice(cleanBody, { chatId });

    if (waitNotice) {
      await sendReply(chat, waitNotice);
    }

    const reply = await buildReply(cleanBody, club, {
      chatId
    });

    if (!reply) {
      return;
    }

    await sendReply(chat, reply);

    logConversation({
      from: message.from,
      isGroup,
      body,
      reply: formatReplyForLog(reply)
    });
  } catch (error) {
    if (isTransientBrowserError(error)) {
      console.error('WhatsApp Web recarregou durante o envio. O bot vai tentar reconectar automaticamente.');
      scheduleReconnect('erro transitório do WhatsApp Web durante resposta');
      return;
    }

    console.error('Erro ao responder mensagem:', error);
  }
}

async function sendReply(chat, reply) {
  const chatId = chat.id?._serialized || chat.id?.user || 'unknown';

  if (typeof reply === 'string') {
    if (!shouldSendReply(chatId, reply)) {
      console.log('Resposta duplicada suprimida.');
      return;
    }

    await sendMessageSafely(chat, reply, undefined, 'texto');
    return;
  }

  if (reply.text) {
    if (!shouldSendReply(chatId, reply.text)) {
      console.log('Resposta duplicada suprimida.');
      return;
    }

    await sendMessageSafely(chat, reply.text, undefined, 'texto');
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
  }
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
  const message = String(error?.message || error).toLowerCase();

  return transientBrowserErrorFragments.some((fragment) => message.includes(fragment));
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveMediaPath(mediaPath) {
  return path.isAbsolute(mediaPath) ? mediaPath : path.resolve(process.cwd(), mediaPath);
}

function formatReplyForLog(reply) {
  if (typeof reply === 'string') {
    return reply;
  }

  const media = (reply.media || []).map((item) => `[mídia: ${item.path || item}]`);
  return [reply.text, ...media].filter(Boolean).join('\n');
}

async function startClient() {
  if (starting) {
    return;
  }

  starting = true;
  startReadyTimeout();
  await client.initialize();
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

function scheduleReconnect(reason) {
  if (reconnectTimer || starting) {
    return;
  }

  console.log(`Tentando reconectar em ${Math.round(settings.reconnectDelayMs / 1000)} segundos (${reason}).`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = undefined;
    stopHealthCheck();
    stopReadyTimeout();

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

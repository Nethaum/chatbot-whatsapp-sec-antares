import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { rootPath } from './config.js';

const stateDir = rootPath('.bot_state');
const processedDir = path.join(stateDir, 'processed-messages');
const outgoingDir = path.join(stateDir, 'outgoing-replies');
const lockPath = path.join(stateDir, 'bot.lock');
const processedMessageTtlMs = 24 * 60 * 60 * 1000;
const outgoingReplyTtlMs = 15 * 1000;
const processedCleanupIntervalMs = 60 * 60 * 1000;
const outgoingCleanupIntervalMs = 60 * 1000;

let lockFd;
let lastProcessedCleanupAt = 0;
let lastOutgoingCleanupAt = 0;
let releaseHandlersRegistered = false;

export function acquireInstanceLock() {
  fs.mkdirSync(stateDir, { recursive: true });

  try {
    createLock();
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }

    const lock = readLock();

    if (lock?.pid && isProcessRunning(lock.pid)) {
      throw new Error(`O bot ja parece estar rodando no processo ${lock.pid}. Feche a outra janela antes de iniciar de novo.`);
    }

    fs.rmSync(lockPath, { force: true });
    createLock();
  }

  registerReleaseHandlers();
}

export function shouldProcessMessage(message) {
  fs.mkdirSync(processedDir, { recursive: true });
  cleanupProcessedMessages();

  return (
    claimProcessedMessageKey('id', getMessageId(message), message) &&
    claimProcessedMessageKey('semantic', getSemanticMessageKey(message), message)
  );
}

export function shouldSendReply(chatId, content) {
  fs.mkdirSync(outgoingDir, { recursive: true });
  cleanupOutgoingReplies();

  return claimOutgoingReplyKey(getOutgoingReplyKey(chatId, content), chatId);
}

function createLock() {
  lockFd = fs.openSync(lockPath, 'wx');
  fs.writeFileSync(
    lockFd,
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`
  );
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function registerReleaseHandlers() {
  if (releaseHandlersRegistered) {
    return;
  }

  releaseHandlersRegistered = true;
  process.on('exit', releaseLock);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      releaseLock();
      process.exit(0);
    });
  }
}

function releaseLock() {
  if (lockFd === undefined) {
    return;
  }

  try {
    fs.closeSync(lockFd);
  } catch {
    // The process is already shutting down; there is nothing useful to do here.
  }

  lockFd = undefined;

  try {
    const lock = readLock();

    if (lock?.pid === process.pid) {
      fs.rmSync(lockPath, { force: true });
    }
  } catch {
    // Best-effort cleanup only.
  }
}

function getMessageId(message) {
  return message.id?._serialized || `${message.from}:${message.timestamp}:${message.body}`;
}

function getSemanticMessageKey(message) {
  const body = String(message.body || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const timestamp = message.timestamp || Math.floor(Date.now() / 10_000);

  return `${message.from}:${timestamp}:${body}`;
}

function claimProcessedMessageKey(type, value, message) {
  const filePath = path.join(processedDir, `${hash(`${type}:${value}`)}.json`);
  const entry = {
    type,
    id: value,
    from: message.from,
    at: new Date().toISOString()
  };

  try {
    fs.writeFileSync(filePath, `${JSON.stringify(entry)}\n`, { flag: 'wx' });
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      return false;
    }

    throw error;
  }
}

function getOutgoingReplyKey(chatId, content) {
  return `${chatId}:${String(content || '').replace(/\s+/g, ' ').trim()}`;
}

function claimOutgoingReplyKey(value, chatId) {
  const filePath = path.join(outgoingDir, `${hash(value)}.json`);
  const entry = {
    chatId,
    key: value,
    at: new Date().toISOString()
  };

  const result = writeJsonOnce(filePath, entry);

  if (result === 'created') {
    return true;
  }

  if (result === 'exists' && isFileExpired(filePath, outgoingReplyTtlMs)) {
    fs.rmSync(filePath, { force: true });
    return writeJsonOnce(filePath, entry) === 'created';
  }

  return false;
}

function writeJsonOnce(filePath, entry) {
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(entry)}\n`, { flag: 'wx' });
    return 'created';
  } catch (error) {
    if (error.code === 'EEXIST') {
      return 'exists';
    }

    if (error.code === 'ENOENT') {
      return 'missing';
    }

    throw error;
  }
}

function isFileExpired(filePath, ttlMs) {
  try {
    return Date.now() - fs.statSync(filePath).mtimeMs > ttlMs;
  } catch {
    return true;
  }
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanupProcessedMessages() {
  lastProcessedCleanupAt = cleanupDirectory(
    processedDir,
    processedMessageTtlMs,
    processedCleanupIntervalMs,
    lastProcessedCleanupAt
  );
}

function cleanupOutgoingReplies() {
  lastOutgoingCleanupAt = cleanupDirectory(outgoingDir, outgoingReplyTtlMs, outgoingCleanupIntervalMs, lastOutgoingCleanupAt);
}

function cleanupDirectory(directory, ttlMs, cleanupIntervalMs, lastCleanupAt) {
  const now = Date.now();

  if (now - lastCleanupAt < cleanupIntervalMs) {
    return lastCleanupAt;
  }

  for (const fileName of fs.readdirSync(directory)) {
    const filePath = path.join(directory, fileName);

    try {
      const stat = fs.statSync(filePath);

      if (stat.isFile() && now - stat.mtimeMs > ttlMs) {
        fs.rmSync(filePath, { force: true });
      }
    } catch {
      // Another process may have cleaned this file first.
    }
  }

  return now;
}

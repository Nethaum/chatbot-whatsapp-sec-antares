export function isGroupChatId(value) {
  return String(value || '').toLowerCase().includes('@g.us');
}

export function isGroupChat(chat) {
  return Boolean(chat?.isGroup) || isGroupChatId(chat?.id?._serialized);
}

export function isGroupMessage(message) {
  return [
    message?.from,
    message?.to,
    message?.author,
    message?.id?.remote,
    message?.id?._serialized
  ].some(isGroupChatId);
}

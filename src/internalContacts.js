import { phoneHasAreaCode, phoneVariants } from './memberRegistry.js';
import { normalizeText } from './text.js';

const internalNotificationMarkers = [
  'nova solicitacao de reserva sec antares',
  'encaminhado automaticamente pelo atendimento da sec antares'
];

export function isInternalContactPhone(club, phones) {
  const contactPhones = internalContactPhones(club);

  if (!contactPhones.size) {
    return false;
  }

  return phoneList(phones).some((phone) => hasSharedPhone(contactPhones, phone));
}

export function isInternalNotificationText(text) {
  const normalized = normalizeMessageSignature(text);
  return internalNotificationMarkers.some((marker) => normalized.includes(marker));
}

function internalContactPhones(club) {
  const contacts = Array.isArray(club.contacts) ? club.contacts : [];
  return new Set(contacts.flatMap((contact) => phoneVariantsWithAreaCode(contact.phone)));
}

function phoneList(phones) {
  return Array.isArray(phones) ? phones.filter(Boolean) : [phones].filter(Boolean);
}

function hasSharedPhone(contactPhones, phone) {
  for (const variant of phoneVariantsWithAreaCode(phone)) {
    if (contactPhones.has(variant)) {
      return true;
    }
  }

  return false;
}

function phoneVariantsWithAreaCode(phone) {
  const digits = phoneDigits(phone);

  if (!phoneHasAreaCode(digits)) {
    return [];
  }

  return [...phoneVariants(digits)].filter(phoneHasAreaCode);
}

function normalizeMessageSignature(text) {
  return normalizeText(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phoneDigits(phone) {
  return String(phone || '')
    .replace(/@.+$/, '')
    .replace(/\D/g, '');
}

import { normalizeText } from './text.js';

const contactIconRules = [
  { icon: '🍽️', words: ['economo', 'restaurante'] },
  { icon: '🏐', words: ['esporte', 'quadra'] },
  { icon: '🗂️', words: ['secretaria'] },
  { icon: '🎊', words: ['social', 'saloes'] },
  { icon: '💳', words: ['tesouraria', 'financeiro'] }
];

export function findContactByArea(club, area) {
  return club.contacts?.find((contact) => normalizeText(contact.area) === normalizeText(area));
}

export function formatContactRedirect(contact, message) {
  const link = buildWhatsAppLink(contact.phone, message);
  const lines = [
    `📲 Atendimento responsável: ${contact.area}`,
    `WhatsApp: ${contact.phone}`
  ];

  if (link) {
    lines.push(message ? `Abrir mensagem pronta: ${link}` : `Abrir conversa: ${link}`);
  }

  return lines;
}

export function formatContactLine(contact) {
  return `• ${contactIcon(contact)} ${contactLabel(contact)}: ${contact.phone}`;
}

export function sortedContacts(contacts = []) {
  return [...contacts].sort((first, second) =>
    contactLabel(first).localeCompare(contactLabel(second), 'pt-BR', { sensitivity: 'base' })
  );
}

function buildWhatsAppLink(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  const encodedMessage = encodeURIComponent(message || '');
  return encodedMessage ? `https://wa.me/${digits}?text=${encodedMessage}` : `https://wa.me/${digits}`;
}

function contactLabel(contact) {
  const area = normalizeText(contact.area);
  const contactName = String(contact.name || '').trim();
  const normalizedContactName = normalizeText(contactName);

  if (shouldUseAreaOnly(area) || !contactName || normalizedContactName === area) {
    return contact.area;
  }

  if (normalizedContactName.includes(area)) {
    return contactName;
  }

  return `${contact.area} - ${contactName}`;
}

function shouldUseAreaOnly(area) {
  return ['secretaria', 'tesouraria', 'economo'].includes(area);
}

function contactIcon(contact) {
  const label = normalizeText(`${contact.area} ${contact.name}`);
  const rule = contactIconRules.find((item) => item.words.some((word) => label.includes(word)));

  return rule?.icon || '📌';
}

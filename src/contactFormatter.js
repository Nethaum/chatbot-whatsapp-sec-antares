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

export function formatContactInfo(contact) {
  return [
    `📲 Atendimento responsável: ${contact.area}`,
    `WhatsApp: ${contact.phone}`
  ];
}

export function formatContactLine(contact) {
  return `• ${contactIcon(contact)} ${contactLabel(contact)}: ${contact.phone}`;
}

export function sortedContacts(contacts = []) {
  return [...contacts].sort((first, second) =>
    contactLabel(first).localeCompare(contactLabel(second), 'pt-BR', { sensitivity: 'base' })
  );
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

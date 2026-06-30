import { phoneHasAreaCode, phoneHash, phoneSuffixLookupKey, phoneVariants } from './memberRegistry.js';
import { normalizeText } from './text.js';

export function buildIndexEntries(members) {
  const candidatesByKey = new Map();
  const suffixCandidates = new Map();

  for (const member of members) {
    const name = String(member.name || '').trim();

    if (!name) {
      continue;
    }

    for (const phone of member.phones || []) {
      addExactPhoneCandidates(candidatesByKey, member, name, phone);
      addSuffixCandidate(suffixCandidates, member, name, phone);
    }
  }

  addUniqueSuffixCandidates(candidatesByKey, suffixCandidates);

  return [...candidatesByKey.values()].map(publicIndexEntry);
}

function addExactPhoneCandidates(candidatesByKey, member, name, phone) {
  for (const variant of phoneVariants(phone)) {
    if (!phoneHasAreaCode(variant)) {
      continue;
    }

    addBestCandidate(candidatesByKey, phoneHash(variant), indexCandidate(member, name));
  }
}

function addSuffixCandidate(suffixCandidates, member, name, phone) {
  const key = phoneSuffixLookupKey(phone);

  if (!key) {
    return;
  }

  const candidates = suffixCandidates.get(key) || new Map();
  candidates.set(memberIdentity(member, name), indexCandidate(member, name));
  suffixCandidates.set(key, candidates);
}

function addUniqueSuffixCandidates(candidatesByKey, suffixCandidates) {
  for (const [suffixKey, candidatesByMember] of suffixCandidates) {
    const candidates = [...candidatesByMember.values()];

    if (candidates.length !== 1) {
      continue;
    }

    addBestCandidate(candidatesByKey, phoneHash(suffixKey), candidates[0]);
  }
}

function addBestCandidate(candidatesByKey, key, candidate) {
  const current = candidatesByKey.get(key);

  if (!current || candidate.priority > current.priority) {
    candidatesByKey.set(key, {
      key,
      ...candidate
    });
  }
}

function indexCandidate(member, name) {
  return {
    name: encodeIndexText(name),
    holder: member.isHolder ? 1 : undefined,
    sheet: encodeIndexText(member.worksheet),
    category: encodeIndexText(member.category),
    priority: memberPriority(member)
  };
}

function publicIndexEntry(candidate) {
  return Object.fromEntries(
    Object.entries(candidate).filter(([key, value]) => key !== 'priority' && value !== undefined && value !== '')
  );
}

function memberIdentity(member, name) {
  return [normalizeText(name), normalizeText(member.worksheet), member.rowNumber || ''].join('|');
}

function memberPriority(member) {
  let priority = 0;
  const worksheet = normalizeText(member.worksheet);

  if (member.isHolder) {
    priority += 1000;
  }

  if (isActiveMemberWorksheet(worksheet)) {
    priority += 100;
  }

  if (isPrimaryMemberWorksheet(worksheet)) {
    priority += 50;
  }

  if (worksheet.includes('diretoria')) {
    priority -= 10;
  }

  if (isInactiveMemberWorksheet(worksheet)) {
    priority -= 100;
  }

  return priority;
}

function isPrimaryMemberWorksheet(worksheet) {
  return worksheet.includes('lista de socios patrimoniais') || worksheet.includes('lista de socios contribuintes');
}

function isActiveMemberWorksheet(worksheet) {
  return !isInactiveMemberWorksheet(worksheet);
}

function isInactiveMemberWorksheet(worksheet) {
  return worksheet.includes('desistente') || worksheet.includes('inativo') || worksheet.includes('cancelado');
}

function encodeIndexText(value) {
  const text = String(value || '').trim();
  return text ? Buffer.from(text, 'utf8').toString('base64') : '';
}

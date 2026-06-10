import { containsAny, normalizeText } from './text.js';
import { buildEventsReply, checkReservationAvailability } from './eventAgenda.js';
import { buildReservationPricingText } from './reservationPricing.js';
import { checkCourtAvailability } from './courtAgenda.js';
import { formatDate, weekdayName } from './dateUtils.js';
import {
  acknowledgementTriggers,
  backTriggers,
  cancelFlowTriggers,
  changeDateTriggers,
  closingTriggers,
  contextMainMenuTriggers,
  correctionTriggers,
  dateConfirmationTriggers,
  feedbackSubmitTriggers,
  finishConversationTriggers,
  helpTriggers,
  intentMatchers,
  mainMenuTriggers,
  menuNumberMap,
  negativeConfirmationTriggers,
  parentMenuShortcutLabels,
  pauseRequestTriggers,
  reservationNumberMap,
  reservationSubmenuTriggers,
  screenParents
} from './replyLexicon.js';

const reservationStates = new Map();
const membershipStates = new Map();
const feedbackStates = new Map();
const navigationStates = new Map();

const hourNumberPattern = '(?:[01]?\\d|2[0-3])';
const markedTimePattern = `${hourNumberPattern}(?:h(?:rs?|s)?(?:(?:[0-5]\\d)(?:min)?)?|:[0-5]\\d|\\s*horas?)`;
const reservationTimePattern = `(?:${markedTimePattern}|${hourNumberPattern})`;
const reservationTimeRegex = new RegExp(`\\b${reservationTimePattern}\\b`, 'i');
const reservationTimeGlobalRegex = new RegExp(`\\b${reservationTimePattern}\\b`, 'gi');
const dateMentionGlobalRegex = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g;

export function buildWaitNotice(input, context = {}) {
  const text = normalizeText(input);
  const chatId = context.chatId || 'default';
  const reservationState = reservationStates.get(chatId);

  if (shouldSkipWaitNotice(text)) {
    return null;
  }

  if (reservationState) {
    return reservationWaitNotice(text, reservationState);
  }

  if (reservationNumberMap[text]?.requiresDate) {
    return '⏳ Só um instante, estou consultando as informações do ambiente.';
  }

  const intentKey = findIntentKey(text);

  if (intentKey === 'events') {
    return '⏳ Só um instante, estou atualizando a agenda de eventos.';
  }

  if (intentKey === 'membership') {
    return '⏳ Só um instante, estou preparando o material de apresentação.';
  }

  return null;
}

export async function buildReply(input, club, context = {}) {
  const text = normalizeText(input);
  const chatId = context.chatId || 'default';
  const reservationState = reservationStates.get(chatId);
  const membershipState = membershipStates.get(chatId);
  const feedbackState = feedbackStates.get(chatId);

  if (reservationState) {
    return handleActiveReservationState(input, text, reservationState, club, chatId);
  }

  if (membershipState) {
    return handleActiveMembershipState(input, text, membershipState, club, chatId);
  }

  if (feedbackState) {
    return handleActiveFeedbackState(input, text, feedbackState, club, chatId);
  }

  if (shouldShowMainMenu(text)) {
    return resetToMainMenu(chatId, club);
  }

  if (shouldGoBack(text)) {
    return navigateBack(chatId, club);
  }

  if (shouldCloseConversation(text)) {
    return closeConversation(chatId, club);
  }

  if (reservationNumberMap[text]) {
    clearMembershipState(chatId);
    clearFeedbackState(chatId);
    return handleReservationSpaceSelection(reservationNumberMap[text], chatId);
  }

  const intentKey = findIntentKey(text);

  return replyForIntent(intentKey, club, chatId);
}

function shouldSkipWaitNotice(text) {
  return (
    shouldShowMainMenu(text) ||
    shouldGoBack(text) ||
    shouldOpenReservationsSubmenu(text) ||
    shouldCloseConversation(text) ||
    isCancelCommand(text) ||
    isDateConfirmation(text) ||
    isNegativeConfirmation(text)
  );
}

function reservationWaitNotice(text, state) {
  if (state.step === 'awaiting_date' || state.step === 'awaiting_date_confirmation') {
    return '⏳ Só um instante, estou consultando a disponibilidade na agenda.';
  }

  if (state.step === 'awaiting_court_date' || state.step === 'awaiting_court_date_confirmation') {
    return '⏳ Só um instante, estou consultando os horários da Quadra de Areia.';
  }

  if (reservationNumberMap[text]?.requiresDate) {
    return '⏳ Só um instante, estou consultando as informações do ambiente.';
  }

  return null;
}

async function handleActiveReservationState(input, text, state, club, chatId) {
  if (shouldShowContextMainMenu(text)) {
    return resetToMainMenu(chatId, club);
  }

  if (shouldGoBack(text)) {
    return navigateBack(chatId, club);
  }

  if (shouldCloseConversation(text)) {
    return closeConversation(chatId, club);
  }

  if (isCancelCommand(text)) {
    return cancelReservationFlow(state, chatId);
  }

  if (shouldPrioritizeReservationDetails(input, state)) {
    return handleReservationDetailsInput(input, state, club, chatId);
  }

  if (state.step === 'awaiting_court_date') {
    return handleCourtDateInput(input, state, chatId);
  }

  if (state.step === 'awaiting_date') {
    return handleReservationDateInput(input, state, chatId);
  }

  if (state.step === 'awaiting_court_date_confirmation') {
    return handleCourtDateConfirmation(input, text, state, club, chatId);
  }

  if (state.step === 'awaiting_date_confirmation') {
    return handleReservationDateConfirmation(input, text, state, club, chatId);
  }

  if (shouldOpenReservationsSubmenu(text)) {
    clearReservationState(chatId);
    clearFeedbackState(chatId);
    return replyForIntent('reservations', club, chatId);
  }

  if (reservationNumberMap[text]) {
    clearFeedbackState(chatId);
    return handleReservationSpaceSelection(reservationNumberMap[text], chatId);
  }

  const intentKey = findIntentKey(text);

  if (intentKey) {
    clearReservationState(chatId);
    clearFeedbackState(chatId);
    return replyForIntent(intentKey, club, chatId);
  }

  switch (state.step) {
    case 'awaiting_reservation_details':
      return handleReservationDetailsInput(input, state, club, chatId);
    default:
      clearReservationState(chatId);
      return null;
  }
}

async function handleActiveMembershipState(input, text, state, club, chatId) {
  if (shouldShowContextMainMenu(text)) {
    return resetToMainMenu(chatId, club);
  }

  if (shouldGoBack(text)) {
    clearMembershipState(chatId);
    return navigateBack(chatId, club);
  }

  if (shouldCloseConversation(text)) {
    return closeConversation(chatId, club);
  }

  if (isCancelCommand(text)) {
    clearMembershipState(chatId);
    return withParentShortcuts(membershipRequestPaused(), 'membership');
  }

  if (reservationNumberMap[text]) {
    clearMembershipState(chatId);
    return handleReservationSpaceSelection(reservationNumberMap[text], chatId);
  }

  const intentKey = findIntentKey(text);

  if (intentKey && intentKey !== 'membership') {
    clearMembershipState(chatId);
    return replyForIntent(intentKey, club, chatId);
  }

  if (state.step === 'awaiting_membership_confirmation') {
    return handleMembershipConfirmation(input, text, state, club, chatId);
  }

  return handleMembershipDetailsInput(input, state, chatId);
}

async function handleActiveFeedbackState(input, text, state, club, chatId) {
  if (shouldShowContextMainMenu(text)) {
    return resetToMainMenu(chatId, club);
  }

  if (shouldGoBack(text)) {
    clearFeedbackState(chatId);
    return navigateBack(chatId, club);
  }

  if (shouldSubmitFeedback(text)) {
    return handleFeedbackInput(input, state, chatId, club);
  }

  if (closingTriggers.includes(text)) {
    return closeConversation(chatId, club);
  }

  if (reservationNumberMap[text]) {
    clearFeedbackState(chatId);
    return handleReservationSpaceSelection(reservationNumberMap[text], chatId);
  }

  if (menuNumberMap[text] && menuNumberMap[text] !== 'feedback') {
    clearFeedbackState(chatId);
    return replyForIntent(menuNumberMap[text], club, chatId);
  }

  if (menuNumberMap[text] === 'feedback') {
    return replyForIntent('feedback', club, chatId);
  }

  return handleFeedbackInput(input, state, chatId, club);
}

function shouldPrioritizeReservationDetails(input, state) {
  if (state.step !== 'awaiting_reservation_details') {
    return false;
  }

  const incomingDetails = parseReservationDetails(input);

  return Boolean(incomingDetails.time);
}

function findIntentKey(text) {
  return menuNumberMap[text] || intentMatchers.find((matcher) => containsAny(text, matcher.words))?.key;
}

function resetToMainMenu(chatId, club) {
  clearAllStates(chatId);
  setNavigationScreen(chatId, 'main');
  return menu(club);
}

function closeConversation(chatId, club) {
  clearAllStates(chatId);
  setNavigationScreen(chatId, 'main');
  return closing(club);
}

function clearAllStates(chatId) {
  clearReservationState(chatId);
  clearMembershipState(chatId);
  clearFeedbackState(chatId);
}

async function replyForIntent(intentKey, club, chatId) {
  if (intentKey) {
    setNavigationScreen(chatId, intentKey);
  }

  if (intentKey !== 'membership') {
    clearMembershipState(chatId);
  }

  if (intentKey !== 'feedback') {
    clearFeedbackState(chatId);
  }

  switch (intentKey) {
    case 'reservations':
      return withNavigationShortcuts(reservations(club), 'reservations');
    case 'events':
      return withNavigationShortcuts(events(await buildEventsReply(), club), 'events');
    case 'dues':
      return withNavigationShortcuts(dues(club), 'dues');
    case 'address':
      return withNavigationShortcuts(address(club));
    case 'hours':
      return withNavigationShortcuts(hours(club));
    case 'membership':
      membershipStates.set(chatId, {
        step: 'awaiting_membership_details',
        details: {}
      });
      return withNavigationShortcuts(membership(club), 'membership');
    case 'feedback':
      feedbackStates.set(chatId, {
        step: 'awaiting_feedback',
        messages: []
      });
      return withNavigationShortcuts(feedback(club), 'feedback');
    case 'rules':
      return withNavigationShortcuts(rules(club));
    case 'handoff':
      return withNavigationShortcuts(handoff(club));
    default:
      return null;
  }
}

async function navigateBack(chatId, club) {
  if (
    [
      'awaiting_date',
      'awaiting_court_date',
      'awaiting_date_confirmation',
      'awaiting_court_date_confirmation',
      'awaiting_reservation_details'
    ].includes(reservationStates.get(chatId)?.step)
  ) {
    clearReservationState(chatId);
    return replyForIntent('reservations', club, chatId);
  }

  const currentScreen = navigationStates.get(chatId)?.screen || 'main';
  const targetScreen = screenParents[currentScreen] || 'main';

  if (targetScreen === 'main') {
    clearReservationState(chatId);
    setNavigationScreen(chatId, 'main');
    return menu(club);
  }

  clearReservationState(chatId);
  return replyForIntent(targetScreen, club, chatId);
}

function shouldShowMainMenu(text) {
  return isBlankOrEmojiOnly(text) || mainMenuTriggers.includes(text) || containsAny(text, helpTriggers);
}

function shouldShowContextMainMenu(text) {
  return isOneOf(text, contextMainMenuTriggers);
}

function shouldOpenReservationsSubmenu(text) {
  return isOneOf(text, reservationSubmenuTriggers);
}

function shouldGoBack(text) {
  return isOneOf(text, backTriggers);
}

function isOneOf(text, triggers) {
  return triggers.includes(text);
}

function isBlankOrEmojiOnly(text) {
  return text === '' || !/[\p{L}\p{N}]/u.test(text);
}

function menu(club) {
  return [
    `👋 ${formatTimeGreeting()}! ${formatMenuWelcome(club)}!`,
    '',
    '❓ Escolha uma opção ou digite uma palavra‑chave:',
    '',
    '1️⃣ Reservas 🗓️',
    '2️⃣ Eventos 🎊',
    '3️⃣ Mensalidade 💳',
    '4️⃣ Associação 🧾',
    '5️⃣ Feedback 💬',
    '',
    '0️⃣ Menu Principal 🏠',
    '',
    '💡 Dica: envie apenas o número da opção para ir direto ao que deseja.'
  ].join('\n');
}

function formatMenuWelcome(club) {
  return (club.welcome || `Bem-vindo(a) ao atendimento da ${club.name}`).replace(/[.!]+$/, '');
}

function formatTimeGreeting(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'America/Sao_Paulo'
    }).format(date)
  );

  if (hour >= 5 && hour < 12) {
    return 'Bom dia';
  }

  if (hour >= 12 && hour < 18) {
    return 'Boa tarde';
  }

  return 'Boa noite';
}

function withNavigationShortcuts(reply, submenuKey, options = {}) {
  const shortcuts = ['0️⃣ Menu Principal 🏠'];

  if (options.showBack && parentMenuShortcutLabels[submenuKey]) {
    shortcuts.push(parentMenuShortcutLabels[submenuKey]);
  }

  if (reply && typeof reply === 'object') {
    return {
      ...reply,
      text: [reply.text, '', ...shortcuts].join('\n')
    };
  }

  return [reply, '', ...shortcuts].join('\n');
}

function withParentShortcuts(reply, submenuKey) {
  return withNavigationShortcuts(reply, submenuKey, { showBack: true });
}

async function handleReservationSpaceSelection(choice, chatId) {
  if (choice.type === 'court') {
    setNavigationScreen(chatId, 'reservationDate');
    reservationStates.set(chatId, {
      step: 'awaiting_court_date',
      choice
    });

    return withParentShortcuts(askCourtDate(choice), 'reservations');
  }

  if (!choice.requiresDate) {
    setNavigationScreen(chatId, 'reservationSpace');
    return withParentShortcuts(selectedReservationSpace(choice), 'reservations');
  }

  setNavigationScreen(chatId, 'reservationDate');
  reservationStates.set(chatId, {
    step: 'awaiting_date',
    choice
  });

  const pricingText = await buildReservationPricingText(choice.name);
  return withParentShortcuts(askReservationDate(choice, pricingText), 'reservations');
}

async function handleCourtDateInput(input, state, chatId) {
  const { choice } = state;

  try {
    const availability = await checkCourtAvailability(input);

    switch (availability.status) {
      case 'invalid_date':
        setNavigationScreen(chatId, 'reservationDate');
        return withParentShortcuts(invalidReservationDate(choice), 'reservations');
      case 'past_date':
        setNavigationScreen(chatId, 'reservationDate');
        return withParentShortcuts(pastReservationDate(choice), 'reservations');
      case 'available':
        if (availability.displayMode !== 'unavailable_only' && !availability.availableSlots.length) {
          setNavigationScreen(chatId, 'reservationDate');
        } else {
          reservationStates.set(chatId, {
            step: 'awaiting_court_date_confirmation',
            choice,
            selectedDate: availability.requestedDate,
            availability
          });
          setNavigationScreen(chatId, 'reservationSpace');
        }

        return withParentShortcuts(courtAvailability(choice, availability), 'reservations');
      default:
        return null;
    }
  } catch (error) {
    console.error('Erro ao consultar disponibilidade da quadra:', error);
    setNavigationScreen(chatId, 'reservationDate');
    return withParentShortcuts(
      [
        `${choice.emoji} ${choice.name}.`,
        '',
        '⚠️ Não foi possível consultar os horários da quadra no momento.',
        '🔄 Tente informar a data novamente em instantes.'
      ].join('\n'),
      'reservations'
    );
  }
}

async function handleReservationDateInput(input, state, chatId) {
  const { choice } = state;

  try {
    const availability = await checkReservationAvailability(choice.name, input);

    switch (availability.status) {
      case 'invalid_date':
        setNavigationScreen(chatId, 'reservationDate');
        return withParentShortcuts(invalidReservationDate(choice), 'reservations');
      case 'past_date':
        setNavigationScreen(chatId, 'reservationDate');
        return withParentShortcuts(pastReservationDate(choice), 'reservations');
      case 'available':
        reservationStates.set(chatId, {
          step: 'awaiting_date_confirmation',
          choice,
          selectedDate: availability.requestedDate,
          details: {}
        });
        setNavigationScreen(chatId, 'reservationSpace');
        return withParentShortcuts(confirmReservationDate(choice, availability.requestedDate), 'reservations');
      case 'unavailable':
        setNavigationScreen(chatId, 'reservationDate');
        return withParentShortcuts(unavailableReservationDate(choice, availability), 'reservations');
      default:
        return null;
    }
  } catch (error) {
    console.error('Erro ao consultar disponibilidade de reserva:', error);
    setNavigationScreen(chatId, 'reservationDate');
    return withParentShortcuts(
      [
        `${choice.emoji} ${choice.name}.`,
        '',
        '⚠️ Não foi possível consultar a disponibilidade no momento.',
        '🔄 Tente informar a data novamente em instantes.'
      ].join('\n'),
      'reservations'
    );
  }
}

async function handleReservationDateConfirmation(input, text, state, club, chatId) {
  if (isDateConfirmation(text)) {
    reservationStates.set(chatId, {
      step: 'awaiting_reservation_details',
      choice: state.choice,
      selectedDate: state.selectedDate,
      details: {}
    });
    setNavigationScreen(chatId, 'reservationSpace');
    return withParentShortcuts(availableReservationDate(state.choice, state.selectedDate), 'reservations');
  }

  if (isNegativeConfirmation(text)) {
    clearReservationState(chatId);
    return replyForIntent('reservations', club, chatId);
  }

  if (isChangeRequest(text)) {
    reservationStates.set(chatId, {
      step: 'awaiting_date',
      choice: state.choice
    });
    setNavigationScreen(chatId, 'reservationDate');
    return withParentShortcuts(askAnotherReservationDate(state.choice), 'reservations');
  }

  return handleReservationDateInput(input, { choice: state.choice }, chatId);
}

async function handleCourtDateConfirmation(input, text, state, club, chatId) {
  if (isDateConfirmation(text)) {
    reservationStates.set(chatId, {
      step: 'awaiting_reservation_details',
      choice: state.choice,
      selectedDate: state.selectedDate,
      details: {}
    });
    setNavigationScreen(chatId, 'reservationSpace');
    return withParentShortcuts(courtReservationDetailsPrompt(state.choice, state.selectedDate), 'reservations');
  }

  if (isNegativeConfirmation(text)) {
    clearReservationState(chatId);
    return replyForIntent('reservations', club, chatId);
  }

  if (isChangeRequest(text)) {
    reservationStates.set(chatId, {
      step: 'awaiting_court_date',
      choice: state.choice
    });
    setNavigationScreen(chatId, 'reservationDate');
    return withParentShortcuts(askAnotherReservationDate(state.choice), 'reservations');
  }

  return handleCourtDateInput(input, { choice: state.choice }, chatId);
}

function isDateConfirmation(text) {
  return isOneOf(text, dateConfirmationTriggers);
}

function isAcknowledgement(text) {
  return isOneOf(text, acknowledgementTriggers);
}

function isNegativeConfirmation(text) {
  return isOneOf(text, negativeConfirmationTriggers);
}

function isChangeRequest(text) {
  return isOneOf(text, changeDateTriggers);
}

function handleReservationDetailsInput(input, state, club, chatId) {
  const { choice } = state;
  const text = normalizeText(input);

  if (shouldGoBack(text)) {
    clearReservationState(chatId);
    return replyForIntent('reservations', club, chatId);
  }

  if (shouldPauseRequest(text)) {
    clearReservationState(chatId);
    return withParentShortcuts(reservationRequestPaused(choice), 'reservations');
  }

  if (isAcknowledgement(text)) {
    return withParentShortcuts(reservationDetailsReminder(choice, state.details || {}, state.selectedDate), 'reservations');
  }

  const incomingDetails = parseReservationDetails(input);
  const details = {
    ...(state.details || {}),
    ...incomingDetails
  };

  if (details.name && details.time) {
    clearReservationState(chatId);
    return withParentShortcuts(reservationRequestReceived(choice, details, state.selectedDate), 'reservations');
  }

  reservationStates.set(chatId, {
    ...state,
    details
  });

  if (details.time && !details.name) {
    return withParentShortcuts(missingReservationName(choice, details, state.selectedDate), 'reservations');
  }

  if (details.name && !details.time) {
    return withParentShortcuts(missingReservationTime(choice, details, state.selectedDate), 'reservations');
  }

  return withParentShortcuts(invalidReservationDetails(choice), 'reservations');
}

function cancelReservationFlow(state, chatId) {
  clearReservationState(chatId);

  if (!state.choice) {
    return null;
  }

  return withParentShortcuts(reservationRequestPaused(state.choice), 'reservations');
}

function shouldPauseRequest(text) {
  return isOneOf(text, pauseRequestTriggers);
}

function handleMembershipDetailsInput(input, state, chatId) {
  const text = normalizeText(input);

  if (shouldPauseRequest(text)) {
    clearMembershipState(chatId);
    return withParentShortcuts(membershipRequestPaused(), 'membership');
  }

  if (isAcknowledgement(text)) {
    return withParentShortcuts(membershipDetailsReminder(state.details || {}), 'membership');
  }

  const incomingDetails = parseMembershipDetails(input);
  const details = {
    ...(state.details || {}),
    ...incomingDetails
  };

  if (details.name && details.phone && details.plan) {
    membershipStates.set(chatId, {
      step: 'awaiting_membership_confirmation',
      details
    });
    return withParentShortcuts(confirmMembershipDetails(details), 'membership');
  }

  membershipStates.set(chatId, {
    ...state,
    details
  });

  return withParentShortcuts(missingMembershipDetails(details), 'membership');
}

function handleMembershipConfirmation(input, text, state, club, chatId) {
  if (isDateConfirmation(text)) {
    clearMembershipState(chatId);
    return withParentShortcuts(membershipRequestReceived(state.details), 'membership');
  }

  if (isOneOf(text, correctionTriggers)) {
    membershipStates.set(chatId, {
      step: 'awaiting_membership_details',
      details: state.details
    });
    return withParentShortcuts(askMembershipCorrection(state.details), 'membership');
  }

  if (isNegativeConfirmation(text)) {
    clearMembershipState(chatId);
    return replyForIntent('membership', club, chatId);
  }

  return handleMembershipDetailsInput(input, {
    step: 'awaiting_membership_details',
    details: state.details
  }, chatId);
}

function parseMembershipDetails(value) {
  const phone = extractPhoneText(value);
  const plan = extractMembershipPlan(value);
  const name = extractMembershipName(value);
  const details = {};

  if (name) {
    details.name = name;
  }

  if (phone) {
    details.phone = phone;
  }

  if (plan) {
    details.plan = plan;
  }

  return details;
}

function extractPhoneText(value) {
  return String(value || '').match(/(?:^|\D)((?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4})\b/)?.[1]?.trim() || '';
}

function extractMembershipPlan(value) {
  const text = normalizeText(value);

  if (text.includes('patrimonial') || text.includes('titulo')) {
    return 'Sócio Patrimonial';
  }

  if (text.includes('contribuinte') || text.includes('mensal')) {
    return 'Sócio Contribuinte';
  }

  return '';
}

function extractMembershipName(value) {
  const withoutPhone = String(value || '').replace(/\b(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4,5}[-\s]?\d{4}\b/g, ' ');
  const cleaned = withoutPhone
    .replace(/\b(?:s[oó]cio|socia|associa[cç][aã]o|associar|patrimonial|contribuinte|t[ií]tulo|titulo|mensal)\b/gi, ' ')
    .replace(/\b(?:quero|ser|virar|plano|interesse|telefone|celular|meu|minha|nome|completo)\b/gi, ' ')
    .replace(/[^\p{L}\s]/gu, ' ');
  const tokens = cleaned.match(/\p{L}{2,}/gu) || [];
  const meaningfulTokens = tokens.filter((token) => !membershipDetailStopWords.has(normalizeText(token)));

  if (!meaningfulTokens.length) {
    return '';
  }

  return meaningfulTokens.join(' ');
}

const membershipDetailStopWords = new Set([
  'a',
  'as',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'eu',
  'para',
  'por',
  'com',
  'um',
  'uma',
  'ok',
  'okay',
  'sim',
  'beleza',
  'blz'
]);

function missingMembershipDetails(details) {
  return membershipDetailsPrompt(details, {
    status: hasAnyMembershipDetail(details)
      ? '✅ Informações recebidas até aqui.'
      : '❌ Não consegui identificar todas as informações.'
  });
}

function membershipDetailsReminder(details) {
  return membershipDetailsPrompt(details);
}

function membershipDetailsPrompt(details, options = {}) {
  const received = formatKnownMembershipDetails(details);

  return [
    '🧾 Associação',
    options.status ? '' : null,
    options.status,
    ...received,
    '',
    '📝 Para continuar, envie:',
    ...missingMembershipFields(details),
    '',
    '💡 Exemplo: João da Silva (00) 00000-0000 Contribuinte'
  ].filter((line) => line !== null && line !== undefined).join('\n');
}

function missingMembershipFields(details) {
  const fields = [];

  if (!details.name) {
    fields.push('• 👤 Nome completo');
  }

  if (!details.phone) {
    fields.push('• 📞 Telefone');
  }

  if (!details.plan) {
    fields.push('• 🧾 Plano de interesse: Patrimonial ou Contribuinte');
  }

  return fields;
}

function hasAnyMembershipDetail(details) {
  return Boolean(details.name || details.phone || details.plan);
}

function confirmMembershipDetails(details) {
  return [
    '🧾 Associação',
    '',
    '🔎 Dados identificados:',
    `• 👤 Nome: ${details.name}`,
    `• 📞 Telefone: ${details.phone}`,
    `• 🧾 Plano: ${details.plan}`,
    '',
    '❓ Deseja enviar a solicitação com esses dados?',
    '✅ Responda *sim* para confirmar.',
    '📝 Envie uma informação corrigida, se necessário.',
    '❌ Responda *não* para voltar ao menu anterior.'
  ].join('\n');
}

function membershipRequestReceived(details) {
  return [
    '🧾 Associação',
    '',
    '✅ Solicitação recebida.',
    '',
    '📌 Dados informados:',
    `• 👤 Nome: ${details.name}`,
    `• 📞 Telefone: ${details.phone}`,
    `• 🧾 Plano: ${details.plan}`,
    '',
    '📞 Nossa equipe vai conferir as informações e retornará o contato em breve.'
  ].join('\n');
}

function askMembershipCorrection(details) {
  return [
    '🧾 Associação',
    '',
    '📌 Dados atuais:',
    `• 👤 Nome: ${details.name}`,
    `• 📞 Telefone: ${details.phone}`,
    `• 🧾 Plano: ${details.plan}`,
    '',
    '📝 Envie a informação que deseja corrigir.',
    '💡 Exemplo: telefone (00) 99999-9999'
  ].join('\n');
}

function formatKnownMembershipDetails(details) {
  const lines = [];

  if (details.name) {
    lines.push(`• 👤 Nome: ${details.name}`);
  }

  if (details.phone) {
    lines.push(`• 📞 Telefone: ${details.phone}`);
  }

  if (details.plan) {
    lines.push(`• 🧾 Plano: ${details.plan}`);
  }

  return lines.length ? ['', '📌 Dados identificados:', ...lines] : [];
}

function membershipRequestPaused() {
  return [
    '🧾 Associação',
    '',
    '👍 Tudo bem. Nenhuma solicitação de associação foi enviada.',
    '',
    '🧾 Quando quiser iniciar novamente, acesse o menu de Associação.'
  ].join('\n');
}

function handleFeedbackInput(input, state, chatId, club) {
  const text = normalizeText(input);
  const messages = state.messages || [];

  if (shouldPauseRequest(text)) {
    clearFeedbackState(chatId);
    return withNavigationShortcuts(feedbackPaused(), 'feedback');
  }

  if (shouldSubmitFeedback(text)) {
    if (!messages.length) {
      return closeConversation(chatId, club);
    }

    clearFeedbackState(chatId);
    return withNavigationShortcuts(feedbackReceived(messages), 'feedback');
  }

  if (!hasMeaningfulFeedback(input)) {
    return withNavigationShortcuts(isAcknowledgement(text) ? feedbackReminder() : invalidFeedback(), 'feedback');
  }

  feedbackStates.set(chatId, {
    ...state,
    messages: [...messages, String(input || '').trim()]
  });

  return null;
}

function hasMeaningfulFeedback(value) {
  return normalizeText(value).replace(/\d/g, '').length >= 3;
}

function shouldSubmitFeedback(text) {
  return isOneOf(text, feedbackSubmitTriggers);
}

function isFinishCommand(text) {
  return isOneOf(text, finishConversationTriggers);
}

function shouldCloseConversation(text) {
  return isFinishCommand(text) || containsAny(text, closingTriggers);
}

function isCancelCommand(text) {
  return isOneOf(text, cancelFlowTriggers);
}

function feedbackReceived(messages = []) {
  return [
    '💬 Feedback',
    '',
    '✅ Mensagem recebida.',
    '',
    '🙏 Obrigado por compartilhar sua opinião com a SEC Antares.',
    '📞 Se necessário, nossa equipe retornará o contato em breve.'
  ].join('\n');
}

function feedbackPaused() {
  return [
    '💬 Feedback',
    '',
    '👍 Tudo bem. Nenhum feedback foi enviado.',
    '',
    '💬 Quando quiser registrar uma mensagem, acesse o menu de Feedback.'
  ].join('\n');
}

function invalidFeedback() {
  return [
    '💬 Feedback',
    '',
    '❌ Não consegui identificar sua mensagem.',
    '',
    '📝 Envie seu elogio, sugestão, reclamação ou comentário.',
    '📨 Quando terminar, envie: *fim*'
  ].join('\n');
}

function feedbackReminder() {
  return [
    '💬 Feedback',
    '',
    '📝 Envie seu elogio, sugestão, reclamação ou comentário.',
    '📨 Quando terminar, envie: *fim*'
  ].join('\n');
}

function askReservationDate(choice, pricingText) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    pricingText,
    '',
    '📅 Informe a data desejada.'
  ]
    .filter((line) => line !== undefined && line !== null)
    .join('\n');
}

function askCourtDate(choice) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    '📅 Informe a data desejada para consultar os horários disponíveis.'
  ].join('\n');
}

function courtAvailability(choice, availability) {
  const lines = [
    `${choice.emoji} ${choice.name}`,
    '',
    `🔎 Data identificada: ${formatDateWithWeekday(availability.requestedDate)}`
  ];

  if (availability.displayMode === 'unavailable_only') {
    lines.push(
      '',
      'ℹ️ Aos sábados e domingos, mostramos apenas os horários já indisponíveis.'
    );

    if (availability.unavailableSlots.length) {
      lines.push('', '❌ Horários indisponíveis:', ...availability.unavailableSlots.map((slot) => `• 🕒 ${slot}`));
    } else {
      lines.push('', '✅ Nenhum horário indisponível informado para essa data.');
    }

    lines.push('', ...confirmDateInstructions());

    return lines.join('\n');
  }

  if (availability.availableSlots.length) {
    lines.push(
      '',
      '✅ Horários disponíveis:',
      ...availability.availableSlots.map((slot) => `• 🕒 ${slot}`),
      '',
      ...confirmDateInstructions()
    );
  } else {
    lines.push(
      '',
      '❌ Não encontrei horários disponíveis para essa data.',
      '',
      '📅 Informe outra data desejada.'
    );
  }

  return lines.join('\n');
}

function formatWeekday(value) {
  return String(value || '').replace(/^./, (letter) => letter.toUpperCase());
}

function formatDateWithWeekday(date) {
  return `${formatDate(date)} (${formatWeekday(weekdayFromDate(date))})`;
}

function weekdayFromDate(date) {
  return weekdayName(date);
}

function confirmDateInstructions() {
  return [
    '❓ Deseja seguir com essa data?',
    '✅ Responda *sim* para continuar.',
    '📅 Informe outra data para consultar.',
    '❌ Responda *não* para voltar ao menu anterior.'
  ];
}

function invalidReservationDate(choice) {
  return [
    `${choice.emoji} ${choice.name}.`,
    '',
    '❌ Não consegui identificar a data.',
    '💡 Exemplo: 25/12'
  ].join('\n');
}

function dateExampleWithNextYear() {
  return `25/12/${new Date().getFullYear() + 1}`;
}

function pastReservationDate(choice) {
  return [
    `${choice.emoji} ${choice.name}.`,
    '',
    '📅 Informe uma data futura para consultar a disponibilidade.',
    `💡 Exemplo: 25/12 ou ${dateExampleWithNextYear()}`
  ].join('\n');
}

function confirmReservationDate(choice, selectedDate) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    `🔎 Data identificada: ${formatDateWithWeekday(selectedDate)}`,
    '',
    ...confirmDateInstructions()
  ].join('\n');
}

function availableReservationDate(choice, selectedDate) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    `✅ Data confirmada: ${formatDateWithWeekday(selectedDate)}`,
    '',
    '📝 Para concluir sua solicitação, envie:',
    '',
    '• 👤 Nome completo do responsável (caso seja dependente, informe o nome do sócio titular)',
    '• 🕒 Horário de início do evento'
  ].join('\n');
}

function courtReservationDetailsPrompt(choice, selectedDate) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    `✅ Data confirmada: ${formatDateWithWeekday(selectedDate)}`,
    '',
    '📝 Para concluir sua solicitação, envie:',
    '',
    '• 👤 Nome completo do sócio titular responsável',
    '• 🕒 Horário desejado'
  ].join('\n');
}

function askAnotherReservationDate(choice) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    '📅 Sem problema. Informe outra data desejada.'
  ].join('\n');
}

function reservationRequestReceived(choice, details, selectedDate) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    '✅ Solicitação recebida.',
    ...formatKnownReservationDetails(details, selectedDate),
    '',
    '📞 Nossa equipe confirmará a reserva e retornará o contato em breve.'
  ].join('\n');
}

function reservationRequestPaused(choice) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    '👍 Tudo bem. Nenhuma solicitação foi enviada.',
    '',
    '🗓️ Quando quiser consultar novamente ou iniciar uma reserva, acesse o menu de reservas.'
  ].join('\n');
}

function reservationDetailsReminder(choice, details, selectedDate) {
  if (details.time && !details.name) {
    return missingReservationName(choice, details, selectedDate);
  }

  if (details.name && !details.time) {
    return missingReservationTime(choice, details, selectedDate);
  }

  return availableReservationDate(choice, selectedDate);
}

function parseReservationDetails(value) {
  const time = extractTimeText(value);
  const name = extractReservationName(value);
  const details = {};

  if (time) {
    details.time = time;
  }

  if (name) {
    details.name = name;
  }

  return details;
}

function extractTimeText(value) {
  return formatReservationTime(stripDateMentions(value).match(reservationTimeRegex)?.[0]);
}

function formatReservationTime(value) {
  const text = String(value || '').trim().toLowerCase();
  const match = text.match(/^([01]?\d|2[0-3])(?:\s*(?:h|hrs?|horas?)\s*([0-5]\d)?|:([0-5]\d))?(?:\s*min)?$/i);

  if (!match) {
    return text;
  }

  const hour = Number(match[1]);
  const minutes = match[2] || match[3] || '';
  const formattedHour = String(hour).padStart(2, '0');

  if (!minutes) {
    return `${formattedHour}h`;
  }

  return `${formattedHour}h${minutes}min`;
}

function extractReservationName(value) {
  const withoutDatesAndTimes = stripDateMentions(value).replace(reservationTimeGlobalRegex, ' ');
  const tokens = withoutDatesAndTimes.match(/\p{L}{2,}/gu) || [];
  const meaningfulTokens = tokens.filter((token) => !reservationDetailStopWords.has(normalizeText(token)));

  if (!meaningfulTokens.length) {
    return '';
  }

  return withoutDatesAndTimes.replace(/\s+/g, ' ').trim();
}

function stripDateMentions(value) {
  return String(value || '').replace(dateMentionGlobalRegex, ' ');
}

const reservationDetailStopWords = new Set([
  'a',
  'as',
  'beleza',
  'blz',
  'certo',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'eu',
  'ok',
  'okay',
  'horario',
  'hora',
  'horas',
  'inicio',
  'evento',
  'nome',
  'completo',
  'responsavel',
  'socio',
  'titular',
  'dependente',
  'reserva',
  'reservar',
  'solicitacao',
  'quero',
  'sim',
  'meu',
  'minha',
  'para',
  'data',
  'desejado',
  'desejada',
  'min',
  'minuto',
  'minutos'
]);

function missingReservationName(choice, details, selectedDate) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    '✅ Horário recebido.',
    ...formatKnownReservationDetails(details, selectedDate),
    '',
    `👤 Agora envie ${reservationNameInstruction(choice)}.`,
    '💡 Exemplo: João da Silva'
  ].join('\n');
}

function missingReservationTime(choice, details, selectedDate) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    '✅ Nome recebido.',
    ...formatKnownReservationDetails(details, selectedDate),
    '',
    `🕒 Agora envie ${choice.type === 'court' ? 'o horário desejado.' : 'o horário de início do evento.'}`,
    '💡 Exemplo: 19 ou 19h'
  ].join('\n');
}

function formatKnownReservationDetails(details = {}, selectedDate) {
  const lines = [];

  if (selectedDate) {
    lines.push(`• 🗓️ Data: ${formatDateWithWeekday(selectedDate)}`);
  }

  if (details.name) {
    lines.push(`• 👤 Nome: ${details.name}`);
  }

  if (details.time) {
    lines.push(`• 🕒 Horário: ${details.time}`);
  }

  return lines.length ? ['', '📌 Dados identificados:', ...lines] : [];
}

function invalidReservationDetails(choice) {
  return [
    `${choice.emoji} ${choice.name}`,
    '',
    '❌ Não consegui identificar os dados da solicitação.',
    '',
    '📝 Envie o nome e o horário, juntos ou em mensagens separadas.',
    '💡 Exemplo: João da Silva 19h'
  ].join('\n');
}

function reservationNameInstruction(choice) {
  if (choice.type === 'court') {
    return 'o nome completo do sócio titular responsável';
  }

  return 'o nome completo do responsável (caso seja dependente, informe o nome do sócio titular)';
}

function unavailableReservationDate(choice, availability) {
  const suggestions = (availability.suggestions || []).map(formatReservationSuggestion);

  const lines = [
    `${choice.emoji} ${choice.name}`,
    '',
    `❌ A data ${formatDateWithWeekday(availability.requestedDate)} não está disponível para este ambiente.`
  ];

  if (suggestions.length) {
    lines.push('', '✨ Sugestões disponíveis no mesmo dia da semana:', ...suggestions);
  }

  lines.push('', '📅 Informe a data desejada.');

  return lines.join('\n');
}

function formatReservationSuggestion(suggestion) {
  const emoji = suggestion.direction === 'previous' ? '⬅️' : '➡️';
  return `${emoji} ${formatDateWithWeekday(suggestion.date)}`;
}

function clearReservationState(chatId) {
  reservationStates.delete(chatId);
}

function clearMembershipState(chatId) {
  membershipStates.delete(chatId);
}

function clearFeedbackState(chatId) {
  feedbackStates.delete(chatId);
}

function setNavigationScreen(chatId, screen) {
  navigationStates.set(chatId, { screen });
}

function reservations(club) {
  const reservationInfo = club.reservations || {};
  const spaces = reservationInfo.spaces?.length
    ? reservationInfo.spaces.map(formatReservationSpace)
    : [
        '1️⃣1️⃣ Salão Principal (400 pessoas) 🏛️',
        '1️⃣2️⃣ Salão Restaurante (120 pessoas) 🍽️',
        '1️⃣3️⃣ Churrasqueira (80 pessoas) 🔥 (inclui Playground 🛝 e Cancha de Bocha 🎳)',
        '1️⃣4️⃣ Quadra de Areia 🏐'
      ];

  return ['❓ Escolha o ambiente que deseja reservar:', '', ...spaces].join('\n');
}

function selectedReservationSpace(choice) {
  return [
    `${choice.emoji} ${choice.name}.`,
    '',
    '📝 Para concluir a solicitação, envie:',
    '',
    '• 👤 Nome completo do sócio titular responsável',
    '• 🗓️ Data',
    '• 🕒 Horário',
    '',
    '📞 Nossa equipe verificará a disponibilidade e responderá em breve.'
  ].join('\n');
}

function formatReservationSpace(space) {
  if (typeof space === 'string') {
    return space;
  }

  const reservationSpaces = {
    11: '1️⃣1️⃣ Salão Principal (400 pessoas) 🏛️',
    12: '1️⃣2️⃣ Salão Restaurante (120 pessoas) 🍽️',
    13: '1️⃣3️⃣ Churrasqueira (80 pessoas) 🔥 (inclui Playground 🛝 e Cancha de Bocha 🎳)',
    14: '1️⃣4️⃣ Quadra de Areia 🏐'
  };

  return reservationSpaces[space.option] || `${space.option}. ${space.name}`;
}

function dues(club) {
  const duesInfo = club.dues || {};
  const lines = ['💳 Mensalidade'];

  if (duesInfo.dueDay) {
    lines.push('', `📅 Vencimento: ${duesInfo.dueDay}`);
  }

  if (duesInfo.values?.length) {
    lines.push('', '💰 Valores:', ...duesInfo.values.map(formatDuesValue));
  }

  if (duesInfo.note) {
    lines.push('', duesInfo.note);
  }

  if (duesInfo.dependentNote) {
    lines.push(duesInfo.dependentNote);
  }

  if (duesInfo.billingContact) {
    lines.push('', '📄 Para consultar situação ou solicitar boleto, entre em contato:', `📞 ${duesInfo.billingContact}`);
  }

  if (lines.length === 1) {
    lines.push('', '💬 Consulte a secretaria para informações de pagamento.');
  }

  return lines.join('\n');
}

function formatDuesValue(item) {
  const emoji = item.emoji ? `${item.emoji} ` : '';
  return `• ${emoji}${item.name}: ${item.amount}`;
}

function address(club) {
  const lines = [`📍 Endereço do ${club.shortName || club.name}:`];

  if (club.address?.line) {
    lines.push(`📌 ${club.address.line}`);
  }

  if (club.address?.mapsUrl) {
    lines.push(`🗺️ ${club.address.mapsUrl}`);
  }

  return lines.join('\n');
}

function hours(club) {
  if (!club.hours?.length) {
    return '🕒 Os horários ainda não foram cadastrados. 💬 Consulte a secretaria para confirmar.';
  }

  return ['🕒 Horários:', ...club.hours.map((item) => `- ${item}`)].join('\n');
}

function membership(club) {
  const membershipInfo = club.membership || {};
  const lines = ['🧾 Associação'];

  if (membershipInfo.plans?.length) {
    lines.push('', '📌 Planos disponíveis:');

    for (const plan of membershipInfo.plans) {
      lines.push(
        '',
        `${plan.emoji || '•'} ${plan.name}`,
        `💰 ${plan.price}`,
        `ℹ️ ${plan.description}`
      );

      if (plan.benefits?.length) {
        lines.push('✅ Benefícios:', ...plan.benefits.map((benefit) => `• ${benefit}`));
      }
    }
  } else {
    lines.push('', withLeadingEmoji(membershipInfo.summary || 'Para se associar, fale com a secretaria.', '🧾'));
  }

  if (membershipInfo.familyNote) {
    lines.push('', membershipInfo.familyNote);
  }

  if (membershipInfo.dependentNote) {
    lines.push(membershipInfo.dependentNote);
  }

  if (membershipInfo.note) {
    lines.push('', `⚠️ ${membershipInfo.note}`);
  }

  if (membershipInfo.images?.length || membershipInfo.attachments?.length) {
    lines.push('', '📎 O material de apresentação segue em anexo.');
  }

  if (club.social?.instagramUrl) {
    lines.push('', '📲 Conheça mais sobre o clube no Instagram:', club.social.instagramUrl);
  }

  if (membershipInfo.cta) {
    lines.push('', `📝 ${membershipInfo.cta}`);
  }

  return {
    text: lines.join('\n'),
    media: [...(membershipInfo.images || []), ...(membershipInfo.attachments || [])]
  };
}

function events(reply, club) {
  if (!club.social?.instagramUrl) {
    return reply;
  }

  return [
    reply,
    '',
    '📲 Acompanhe novidades e registros dos eventos no Instagram:',
    club.social.instagramUrl
  ].join('\n');
}

function feedback(club) {
  const feedbackInfo = club.feedback || {};

  if (typeof feedbackInfo === 'string') {
    return withLeadingEmoji(feedbackInfo, '💬');
  }

  return [
    '💬 Feedback',
    '',
    feedbackInfo.summary || '🙏 Sua opinião ajuda a SEC Antares a melhorar.',
    '',
    feedbackInfo.instruction || '📝 Envie seu elogio, sugestão, reclamação ou comentário.',
    '',
    feedbackInfo.returnNote || '💡 Se desejar retorno, inclua seu nome e telefone.',
    '',
    feedbackInfo.finishNote || '📨 Quando terminar, envie: *fim*'
  ].join('\n');
}

function closing(club) {
  return [
    '✅ Atendimento encerrado.',
    '',
    `🙏 Obrigado por falar com a ${club.shortName || club.name}.`,
    '🏠 Para começar de novo, envie *menu*.'
  ].join('\n');
}

function rules(club) {
  if (!club.rules?.length) {
    return '📋 As regras ainda não foram cadastradas. 💬 Consulte a secretaria para mais informações.';
  }

  return ['📋 Regras principais:', ...club.rules.map((item) => `- ${item}`)].join('\n');
}

function handoff(club) {
  const contacts = club.contacts?.length
    ? ['', '📞 Contatos:', ...club.contacts.map((contact) => `- ${contact.area}: ${contact.name} ${contact.phone}`)]
    : [];

  return [withLeadingEmoji(club.handoff || 'Vou chamar alguém da equipe para continuar o atendimento.', '💬'), ...contacts].join('\n');
}

function withLeadingEmoji(text, emoji) {
  const value = String(text || '').trim();

  if (!value || /^\p{Extended_Pictographic}/u.test(value)) {
    return value;
  }

  return `${emoji} ${value}`;
}

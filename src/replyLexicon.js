export const mainMenuTriggers = [
  '',
  '0',
  'oi',
  'ola',
  'bom dia',
  'boa tarde',
  'boa noite',
  'menu',
  'inicio',
  'comecar',
  'principal',
  'menu inicial',
  'menu principal',
  'voltar ao menu principal',
  'opcoes',
  'ajuda',
  'atendimento',
  'start',
  'home',
  'quero falar com alguem',
  'quero atendimento',
  'quero comecar'
];

export const backTriggers = [
  'v',
  'voltar',
  'voltar ao menu',
  'voltar submenu',
  'voltar ao submenu',
  'menu anterior',
  'submenu anterior',
  'quero voltar'
];

export const helpTriggers = ['nao sei', 'nao entendi', 'como funciona', 'socorro', 'o que posso fazer'];
export const contextMainMenuTriggers = ['0', 'menu', 'inicio', 'home', 'principal', 'menu inicial', 'menu principal', 'voltar ao menu principal'];
export const reservationSubmenuTriggers = ['reservas', 'reserva'];

export const reservationDateChangeTriggers = [
  '15',
  'trocar data',
  'trocar a data',
  'mudar data',
  'mudar a data',
  'alterar data',
  'alterar a data',
  'trocar reserva',
  'trocar a reserva',
  'mudar reserva',
  'mudar a reserva'
];

export const closingTriggers = ['tchau', 'obrigado', 'valeu', 'ate mais', 'encerrar', 'sair', 'finalizar'];
export const finishConversationTriggers = ['fim', ...closingTriggers];

export const feedbackSubmitTriggers = [
  'finalizar',
  'enviar',
  'concluir',
  'pronto',
  'fim',
  'pode enviar',
  'pode encaminhar',
  'encerrar feedback'
];

export const cancelFlowTriggers = [
  'cancelar',
  'cancela',
  'cancelado',
  'desistir',
  'desisto',
  'nao quero',
  'não quero',
  'nao quero reservar',
  'não quero reservar',
  'nao vou reservar',
  'não vou reservar'
];

export const dateConfirmationTriggers = [
  'sim',
  's',
  'ok',
  'okay',
  'confirmo',
  'confirmar',
  'confirmado',
  'pode ser',
  'isso',
  'isso mesmo',
  'essa data',
  'esta data',
  'quero essa',
  'quero esta',
  'seguir',
  'continuar'
];

export const acknowledgementTriggers = ['ok', 'okay', 'certo', 'beleza', 'blz', 'combinado', 'entendi', 'ta bom', 'tá bom'];
export const negativeConfirmationTriggers = ['nao', 'não', 'n', 'nao quero', 'não quero'];

export const changeDateTriggers = [
  'outra',
  'outra data',
  'consultar outra',
  'prefiro outra',
  'trocar',
  'trocar data',
  'mudar',
  'mudar data'
];

export const correctionTriggers = ['corrigir', 'corrigir dados', 'alterar', 'alterar dados'];

export const pauseRequestTriggers = [
  'nada',
  'nao',
  'não',
  'nao quero',
  'não quero',
  'nao quero reservar',
  'não quero reservar',
  'nao vou reservar',
  'não vou reservar',
  'cancelar',
  'cancela',
  'cancelado',
  'desistir',
  'desisto',
  'deixa',
  'deixa assim',
  'deixa quieto',
  'so consultando',
  'só consultando',
  'apenas consultando',
  'estou so consultando',
  'estou só consultando',
  'era so consulta',
  'era só consulta'
];

export const intentMatchers = [
  {
    key: 'reservations',
    words: [
      'reservar',
      'reserva',
      'fazer reserva',
      'agendar',
      'salao',
      'salao principal',
      'salao restaurante',
      'churrasqueira',
      'quadra',
      'quadra de areia',
      'playground',
      'cancha',
      'bocha',
      'espaco',
      'area de festa',
      'disponibilidade',
      'disponivel',
      'datas disponiveis',
      'quero reservar',
      'como reservar',
      'aluguel de espaco',
      'aluguel',
      'alugar',
      'casamento',
      'casamentos'
    ]
  },
  {
    key: 'events',
    words: [
      'eventos',
      'programacao',
      'agenda',
      'proximos eventos',
      'calendario',
      'o que vai ter',
      'atividades',
      'festa',
      'evento hoje',
      'evento amanha'
    ]
  },
  {
    key: 'dues',
    words: ['mensalidade', 'boleto', 'segunda via', 'pagar', 'pagamento', 'fatura', 'atrasado', 'vencimento', 'emitir boleto', 'gerar boleto']
  },
  {
    key: 'address',
    words: ['endereco', 'localizacao', 'onde fica', 'mapa', 'chegar']
  },
  {
    key: 'hours',
    words: ['horario', 'horarios', 'abre', 'fecha', 'funcionamento']
  },
  {
    key: 'restaurant',
    words: ['economo', 'ecônomo', 'restaurante', 'lanchonete', 'almoco', 'almoço', 'comida', 'cardapio', 'cardápio']
  },
  {
    key: 'contacts',
    words: ['contato', 'contatos', 'telefone', 'telefones', 'whatsapp', 'numero', 'número', 'fones']
  },
  {
    key: 'social',
    words: ['instagram', 'rede social', 'redes sociais', 'perfil oficial', 'insta']
  },
  {
    key: 'membership',
    words: [
      'associacao',
      'associar',
      'quero ser socio',
      'virar socio',
      'cadastro',
      'como entrar',
      'valores',
      'planos',
      'documentos necessarios',
      'quero me associar'
    ]
  },
  {
    key: 'feedback',
    words: [
      'feedback',
      'elogio',
      'sugestao',
      'reclamacao',
      'falar com alguem',
      'atendimento humano',
      'suporte',
      'contato',
      'ouvidoria',
      'falar com a administracao',
      'quero deixar um comentario',
      'quero registrar algo'
    ]
  },
  {
    key: 'rules',
    words: ['regra', 'regras', 'convidado', 'visitante', 'carteirinha']
  },
  {
    key: 'handoff',
    words: ['humano', 'atendente', 'equipe', 'secretaria', 'diretoria', 'falar com alguem']
  },
  {
    key: 'about',
    words: ['sobre o bot', 'sobre o robo', 'versao do bot', 'qual a versao', 'voce e um robo', 'voce e um bot', 'informacoes do bot']
  }
];

export const menuNumberMap = {
  1: 'reservations',
  2: 'events',
  3: 'dues',
  4: 'membership',
  5: 'feedback',
  6: 'contacts',
  7: 'about'
};

export const screenParents = {
  reservations: 'main',
  events: 'main',
  dues: 'main',
  address: 'main',
  hours: 'main',
  restaurant: 'main',
  contacts: 'main',
  social: 'main',
  membership: 'main',
  feedback: 'main',
  rules: 'main',
  handoff: 'main',
  about: 'main',
  reservationDate: 'reservations',
  reservationSpace: 'reservations'
};

export const reservationNumberMap = {
  11: {
    name: 'Salão Principal',
    emoji: '🏛️',
    requiresDate: true
  },
  12: {
    name: 'Salão Restaurante',
    emoji: '🍽️',
    requiresDate: true
  },
  13: {
    name: 'Churrasqueira',
    emoji: '🔥',
    requiresDate: true
  },
  14: {
    name: 'Quadra de Areia',
    emoji: '🏐',
    type: 'court'
  }
};

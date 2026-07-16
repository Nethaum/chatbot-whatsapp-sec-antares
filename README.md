# Chatbot WhatsApp para Atendimento de Clube

Sistema local de atendimento automatizado via WhatsApp Web, desenvolvido para responder dúvidas frequentes da SEC Antares e auxiliar a secretaria nos fluxos de reservas, eventos, mensalidade, associação e feedback.

O projeto roda no computador do operador, usa planilhas como fonte de dados para consultas específicas e mantém informações sensíveis fora do repositório.

## Funcionalidades

- Menu principal com saudação conforme o horário.
- Atendimento por palavras-chave e opções numéricas.
- Consulta de eventos em planilha online antes de responder ao usuário.
- Fluxo de reservas para salões, churrasqueira e quadra de areia.
- Consulta de disponibilidade de datas e sugestões alternativas.
- Consulta de horários da quadra de areia conforme regras da agenda.
- Encaminhamento automático das solicitações de reserva ao setor responsável.
- Menu de mensalidade com solicitação de boleto, consulta de situação e informações gerais.
- Menu de associação com planos, benefícios e envio de materiais.
- Coleta de feedback com finalização por palavra-chave.
- Proteção para que contatos internos do clube não recebam atendimento automático.
- Identificação silenciosa de sócios por telefone, usando índice local codificado.
- Bloqueio permanente de respostas em grupos.
- Proteção contra instâncias duplicadas e respostas repetidas.
- Reconexão automática em falhas transitórias do WhatsApp Web.
- Inicialização automática no Windows por tarefa agendada.

## Requisitos

- Node.js 18 ou superior.
- WhatsApp ativo no celular.
- Computador ligado enquanto o atendimento estiver em execução.
- Acesso às planilhas usadas pelo clube, quando houver consultas online.

## Instalação

Instale as dependências:

```powershell
npm.cmd install
```

Copie o arquivo de exemplo de variáveis, se precisar personalizar fontes ou comportamento:

```powershell
Copy-Item .env.example .env
```

Edite `data/club.json` para alterar nome do clube, menus, valores, textos de atendimento, materiais anexos e a estrutura pública dos contatos.

## Execução

Inicie o bot:

```powershell
npm.cmd start
```

No primeiro acesso, escaneie o QR Code pelo celular:

```text
WhatsApp > Aparelhos conectados > Conectar um aparelho
```

Depois da autenticação, a sessão fica salva localmente em `.wwebjs_auth/`.

Para reiniciar após alterações:

```powershell
npm.cmd run restart
```

Para encerrar o bot:

```powershell
npm.cmd run stop
```

Para limpar a sessão salva e gerar um novo QR Code:

```powershell
npm.cmd run reset-session
```

## Inicialização automática no Windows

Para iniciar o bot automaticamente ao entrar na conta do Windows:

```powershell
npm.cmd run autostart:install
```

Para consultar o status ou remover a tarefa:

```powershell
npm.cmd run autostart:status
npm.cmd run autostart:uninstall
```

A saída da execução automática fica em `.bot_state/autostart.log`.

## Configuração

As principais variáveis podem ser ajustadas no `.env`:

```env
BOT_NAME=Assistente do Clube
LOG_MESSAGES=false
AUTH_TIMEOUT_MS=120000
READY_TIMEOUT_MS=180000
SESSION_HEALTH_CHECK_MS=300000
RECONNECT_DELAY_MS=15000
DEFAULT_PHONE_DDD=47
MEMBERS_SOURCE=
MEMBERS_REMOTE_LOOKUP=false
SECRETARIA_PHONE=
ECONOMO_PHONE=
ESPORTES_PHONE=
TESOURARIA_PHONE=
SOCIAL_PHONE=
```

As URLs das planilhas de eventos, valores e quadra também podem ser configuradas pelo `.env`:

```env
EVENTS_SPREADSHEET_URL=
PRICING_SPREADSHEET_URL=
COURT_SPREADSHEET_URL=
```

Quando `PRICING_SPREADSHEET_URL` fica vazio, o bot procura a aba de preços dentro da própria planilha de eventos. Use essa variável apenas se a tabela de valores estiver em um arquivo separado.

Os telefones operacionais dos setores devem ficar apenas no `.env` local. O arquivo `data/club.json` mantém somente a estrutura pública dos contatos.

## Lista de sócios

A identificação de sócios é feita de forma local e silenciosa. O bot não pede identificação ao usuário apenas por não encontrar o número no cadastro.

Para atualizar o índice local a partir da planilha de sócios:

```powershell
npm.cmd run members:update
```

Também é possível informar a fonte diretamente:

```powershell
npm.cmd run members:update -- "C:\caminho\lista-socios.xlsx"
```

O comando gera `data/members.index.json`, arquivo local e ignorado pelo Git. Esse índice armazena chaves codificadas para consulta por telefone e não deve ser enviado ao repositório.

Para testar a localização de um telefone:

```powershell
npm.cmd run members:find -- "+55 47 99999-0000"
```

O sistema considera variações comuns de telefone:

- Com ou sem código do país.
- Com ou sem DDD.
- Com ou sem nono dígito.
- Com prefixo de operadora.
- Final de 8 dígitos, apenas quando não houver duplicidade no índice.

## Atualização mensal da lista de sócios

Para criar a tarefa mensal de atualização:

```powershell
npm.cmd run members:update:install
```

Para consultar ou remover:

```powershell
npm.cmd run members:update:status
npm.cmd run members:update:uninstall
```

## Eventos

Quando o usuário solicita eventos, o bot consulta a planilha configurada em `EVENTS_SPREADSHEET_URL` antes de responder.

Critérios usados:

- A coluna de marcação deve conter `X`.
- As colunas de tipo de evento e horário devem estar preenchidas.
- Apenas eventos futuros do ano corrente são exibidos.
- No fim do ano, podem ser exibidos eventos dos próximos meses do ano seguinte, dentro do limite configurado no fluxo.

## Mensalidade

O menu de mensalidade oferece três opções:

- Solicitar boleto.
- Consultar situação financeira.
- Ver informações sobre vencimento, valores e dependentes.

As solicitações de boleto e consulta de situação são encaminhadas automaticamente para a Tesouraria com o contato do solicitante.

## Reservas

O menu de reservas permite consultar ambientes e datas.

Para salões e churrasqueira, o bot:

- Solicita a data desejada.
- Consulta a agenda de eventos.
- Informa se a data está disponível.
- Sugere datas alternativas no mesmo dia da semana, quando necessário.
- Confirma data, nome e horário antes de registrar a solicitação.
- Informa que a confirmação depende da validação do setor responsável e do pagamento da taxa de limpeza.

Para a quadra de areia, o bot:

- Solicita a data desejada.
- Consulta a planilha da agenda da quadra.
- Exibe horários disponíveis em dias úteis.
- Em fins de semana, exibe apenas horários indisponíveis quando houver.

Após receber os dados necessários, o bot apresenta o resumo ao usuário e encaminha automaticamente a solicitação ao setor responsável:

- Salões e churrasqueira: Social.
- Quadra de Areia: Esportes.

A mensagem enviada ao setor contém ambiente, data, nome, horário e contato do solicitante. Os contatos internos do clube são protegidos para não iniciarem o atendimento automático ao receberem esses encaminhamentos.

## Grupos

O bot atende apenas conversas individuais. Mensagens recebidas em grupos são sempre ignoradas, inclusive quando há mensagens não lidas no momento em que o bot inicia.

## Logs e privacidade

Por padrão, conversas não são gravadas.

Para habilitar logs locais:

```env
LOG_MESSAGES=true
```

Os logs ficam em `logs/conversations.jsonl`. Evite habilitar esse recurso se não houver necessidade operacional.

Arquivos locais ignorados pelo Git:

- `.env`
- `.wwebjs_auth/`
- `.wwebjs_cache/`
- `.bot_state/`
- `logs/`
- `data/members.index.json`
- `data/members.json`
- `data/members.overrides.json`

## Validação

Para conferir sintaxe, fluxos principais, normalização da lista de sócios e proteções operacionais:

```powershell
npm.cmd run check
```

Esse comando executa:

- `check:syntax`
- `check:flows`
- `check:dates`
- `check:members`
- `check:guard`
- `check:groups`
- `check:internal-contacts`

## Estrutura do projeto

```text
assets/              Materiais enviados pelo bot
data/                Configurações públicas e exemplos
scripts/             Rotinas de operação, teste e atualização
src/                 Código principal do bot
.env.example         Exemplo de configuração local
package.json         Scripts e dependências
README.md            Documentação do projeto
```

## Observações de uso

Este projeto usa `whatsapp-web.js`, que automatiza o WhatsApp Web pelo navegador. Ele é adequado para atendimento local e de baixo volume, mas não substitui a WhatsApp Business Platform em operações comerciais de grande escala, campanhas ou envio em massa.

Para reduzir instabilidade:

- Mantenha o computador ligado e conectado à internet.
- Evite usar o mesmo número simultaneamente em outras sessões do WhatsApp Web.
- Não apague `.wwebjs_auth/`, a menos que queira forçar novo QR Code.
- Reinicie o bot após mudanças de código ou configuração.

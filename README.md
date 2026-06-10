# Chatbot WhatsApp para Clube

Projeto local e gratuito para atendimento simples pelo WhatsApp Web. Ele responde perguntas comuns da SEC Antares: reservas, eventos, mensalidade, associação e feedback.

## Importante

Esta versão usa `whatsapp-web.js`, que controla o WhatsApp Web pelo navegador. Ela roda localmente e não exige mensalidade, mas não é a API oficial da Meta. Para uso comercial em grande escala, envio em massa, campanhas ou operação crítica, o caminho oficial é a WhatsApp Business Platform, que pode ter custos por conversa ou mensagem e regras de template.

Use este bot com baixo volume, sem spam e com um número que você aceite testar primeiro.

## Requisitos

- Node.js 18 ou superior
- WhatsApp instalado no celular
- Computador ligado enquanto o bot estiver atendendo

## Como configurar

1. Instale as dependências:

   ```powershell
   npm.cmd install
   ```

2. Ajuste os dados do clube em `data/club.json`.

3. Rode o bot:

   ```powershell
   npm.cmd start
   ```

4. Escaneie o QR code no terminal:

   WhatsApp > Aparelhos conectados > Conectar um aparelho

Depois do primeiro login, a sessão fica salva na pasta `.wwebjs_auth/`.

Mantenha apenas uma janela do bot aberta. Se o bot for iniciado duas vezes, as mensagens podem sair duplicadas; esta versão cria uma trava local e encerra a segunda instância para evitar esse problema.

O bot também guarda mensagens e respostas recentes para evitar repetições quando o WhatsApp Web dispara o mesmo evento mais de uma vez.

Depois de alterar o código ou os dados do clube, reinicie com:

```powershell
npm.cmd run restart
```

Se precisar escanear o QR Code novamente, limpe a sessão salva e reinicie com:

```powershell
npm.cmd run reset-session
```

Para conferir sintaxe, fluxos principais e proteção contra duplicidade:

```powershell
npm.cmd run check
```

## Sessão do WhatsApp

O bot usa a sessão salva pelo WhatsApp Web em `.wwebjs_auth/`. Isso reduz a necessidade de escanear o QR Code novamente, mas não impede completamente que o WhatsApp encerre a sessão por segurança, mudança no celular, muito tempo offline ou conflito com outro WhatsApp Web.

Para reduzir quedas:

- Mantenha o computador ligado, sem suspender ou hibernar, e com internet estável.
- Evite abrir o mesmo número em outras janelas do WhatsApp Web.
- Não apague a pasta `.wwebjs_auth/`, a menos que queira forçar um QR Code novo.
- Deixe o bot rodando continuamente.

O bot verifica a sessão a cada 5 minutos e tenta reconectar automaticamente quando detectar desconexão. Esses tempos podem ser ajustados no `.env`:

```env
SESSION_HEALTH_CHECK_MS=300000
RECONNECT_DELAY_MS=15000
AUTH_TIMEOUT_MS=120000
```

## Como testar

Envie mensagens para o número conectado, por exemplo:

- `oi`
- `eventos`
- `mensalidade`
- `quero ser sócio`
- `feedback`

## Eventos online

Quando o usuário pede eventos, o bot baixa a planilha definida em `EVENTS_SPREADSHEET_URL` e atualiza a resposta antes de enviá-la pelo WhatsApp.

Regras usadas na aba `Agenda`:

- A linha 4 deve conter os cabeçalhos.
- A coluna B deve conter a data.
- A coluna C deve conter `X`.
- As colunas `Tipo de evento` e `HORÁRIO` devem estar preenchidas.
- O bot mostra apenas eventos futuros do ano corrente. A partir de outubro, também aceita eventos de até 3 meses à frente, mesmo que entrem no ano seguinte.

Se nenhum registro cumprir os critérios, a resposta será:

```text
🎊 Eventos

* 📭 Nenhum evento programado
```

## Grupos

Por padrão, o bot não responde em grupos. Para permitir respostas em grupos, crie um arquivo `.env` com:

```env
RESPOND_IN_GROUPS=true
GROUP_COMMAND_PREFIX=!clube
```

Em grupos, use mensagens como:

```text
!clube agenda
```

## Logs

Por padrão, as conversas não são gravadas. Para gravar um arquivo local em `logs/conversations.jsonl`, use:

```env
LOG_MESSAGES=true
```

Evite registrar dados pessoais se isso não for necessário para a operação do clube.

## Personalização rápida

Edite `data/club.json` para trocar:

- Nome do clube
- Endereço e link do mapa
- Mensalidade
- Planos de associação
- Contatos
- Feedback
- Texto de encaminhamento para atendimento humano

## Próximos passos possíveis

- Adicionar cadastro de interessados em CSV
- Integrar com agenda local do clube
- Adicionar respostas por modalidade, como tênis, futebol, natação e eventos sociais
- Conectar com um modelo local via Ollama para respostas mais livres

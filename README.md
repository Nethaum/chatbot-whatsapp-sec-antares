# Chatbot WhatsApp para Clube

Projeto local e gratuito para atendimento simples pelo WhatsApp Web. Ele responde perguntas comuns da SEC Antares: reservas, eventos, mensalidade, associacao e feedback.

## Importante

Esta versao usa `whatsapp-web.js`, que controla o WhatsApp Web pelo navegador. Ela roda localmente e nao exige mensalidade, mas nao e a API oficial da Meta. Para uso comercial grande, envio em massa, campanhas ou operacao critica, o caminho oficial e a WhatsApp Business Platform, que pode ter custos por conversa/mensagem e regras de template.

Use este bot com baixo volume, sem spam, e com um numero que voce aceite testar primeiro.

## Requisitos

- Node.js 18 ou superior
- WhatsApp instalado no celular
- Computador ligado enquanto o bot estiver atendendo

## Como configurar

1. Instale as dependencias:

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

Depois do primeiro login, a sessao fica salva na pasta `.wwebjs_auth/`.

Mantenha apenas uma janela do bot aberta. Se o bot for iniciado duas vezes, as mensagens podem sair duplicadas; esta versao cria uma trava local e encerra a segunda instancia para evitar esse problema.

O bot tambem guarda mensagens e respostas recentes para evitar repeticoes quando o WhatsApp Web dispara o mesmo evento mais de uma vez.

Depois de alterar o codigo ou os dados do clube, reinicie com:

```powershell
npm.cmd run restart
```

Se precisar escanear o QR Code novamente, limpe a sessao salva e reinicie com:

```powershell
npm.cmd run reset-session
```

Para conferir sintaxe, fluxos principais e protecao contra duplicidade:

```powershell
npm.cmd run check
```

## Sessao do WhatsApp

O bot usa a sessao salva pelo WhatsApp Web em `.wwebjs_auth/`. Isso reduz a necessidade de escanear QR Code novamente, mas nao impede 100% que o WhatsApp encerre a sessao por seguranca, mudanca no celular, muito tempo offline ou conflito com outro WhatsApp Web.

Para reduzir quedas:

- Mantenha o computador ligado, sem suspender/hibernar, e com internet estavel.
- Evite abrir o mesmo numero em outras janelas do WhatsApp Web.
- Nao apague a pasta `.wwebjs_auth/`, a menos que queira forcar um QR Code novo.
- Deixe o bot rodando continuamente.

O bot verifica a sessao a cada 5 minutos e tenta reconectar automaticamente quando detectar desconexao. Estes tempos podem ser ajustados no `.env`:

```env
SESSION_HEALTH_CHECK_MS=300000
RECONNECT_DELAY_MS=15000
AUTH_TIMEOUT_MS=120000
```

## Como testar

Envie mensagens para o numero conectado, por exemplo:

- `oi`
- `eventos`
- `mensalidade`
- `quero ser socio`
- `feedback`

## Eventos online

Quando o usuario pede eventos, o bot baixa a planilha definida em `EVENTS_SPREADSHEET_URL` e atualiza a resposta antes de enviar no WhatsApp.

Regras usadas na aba `Agenda`:

- A linha 4 deve conter os cabecalhos.
- A coluna B deve conter a data.
- A coluna C deve conter `X`.
- As colunas `Tipo de evento` e `HORÁRIO` devem estar preenchidas.
- O bot mostra apenas eventos futuros do ano corrente. A partir de outubro, tambem aceita eventos de ate 3 meses a frente, mesmo que entrem no ano seguinte.

Se nenhum registro cumprir os criterios, a resposta sera:

```text
🎊 Eventos

* 📭 Nenhum evento programado
```

## Grupos

Por padrao, o bot nao responde em grupos. Para permitir respostas em grupos, crie um arquivo `.env` com:

```env
RESPOND_IN_GROUPS=true
GROUP_COMMAND_PREFIX=!clube
```

Em grupos, use mensagens como:

```text
!clube agenda
```

## Logs

Por padrao, as conversas nao sao gravadas. Para gravar um arquivo local em `logs/conversations.jsonl`, use:

```env
LOG_MESSAGES=true
```

Evite registrar dados pessoais se isso nao for necessario para a operacao do clube.

## Personalizacao rapida

Edite `data/club.json` para trocar:

- Nome do clube
- Endereco e link do mapa
- Mensalidade
- Planos de associacao
- Contatos
- Feedback
- Texto de encaminhamento para atendimento humano

## Proximos passos possiveis

- Adicionar cadastro de interessados em CSV
- Integrar com agenda local do clube
- Adicionar respostas por modalidade, como tenis, futebol, natacao e eventos sociais
- Conectar com um modelo local via Ollama para respostas mais livres

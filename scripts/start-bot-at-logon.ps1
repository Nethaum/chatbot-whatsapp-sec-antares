$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$stateDir = Join-Path $root '.bot_state'
$logPath = Join-Path $stateDir 'autostart.log'
$sessionPath = Join-Path $root '.wwebjs_auth\session-clube'
$officialPhone = '+55 47 9702-2875'

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
Set-Location $root

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

Add-Content -LiteralPath $logPath -Value "[$startedAt] Iniciando o chatbot da SEC Antares."

if (-not (Test-Path -LiteralPath $sessionPath)) {
  Add-Content -LiteralPath $logPath -Value "Sessao do WhatsApp nao encontrada. Inicie manualmente e escaneie o QR Code com o celular oficial da secretaria: $officialPhone."
  exit 1
}

try {
  & $npm start *>> $logPath
  $exitCode = $LASTEXITCODE
} catch {
  Add-Content -LiteralPath $logPath -Value "Erro ao iniciar o bot: $($_.Exception.Message)"
  $exitCode = 1
}

$finishedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -LiteralPath $logPath -Value "[$finishedAt] Processo encerrado com codigo $exitCode."
exit $exitCode

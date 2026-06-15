$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$stateDir = Join-Path $root '.bot_state'
$logPath = Join-Path $stateDir 'autostart.log'

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
Set-Location $root

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

Add-Content -LiteralPath $logPath -Value "[$startedAt] Iniciando o chatbot da SEC Antares."

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

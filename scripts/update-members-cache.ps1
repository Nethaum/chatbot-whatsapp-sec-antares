$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$stateDir = Join-Path $root '.bot_state'
$logPath = Join-Path $stateDir 'members-update.log'

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
Set-Location $root

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

Add-Content -LiteralPath $logPath -Value "[$startedAt] Atualizando lista local de socios."

try {
  & $npm run members:update *>> $logPath
  $exitCode = $LASTEXITCODE
} catch {
  Add-Content -LiteralPath $logPath -Value "Erro ao atualizar lista de socios: $($_.Exception.Message)"
  $exitCode = 1
}

$finishedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -LiteralPath $logPath -Value "[$finishedAt] Atualizacao finalizada com codigo $exitCode."
exit $exitCode

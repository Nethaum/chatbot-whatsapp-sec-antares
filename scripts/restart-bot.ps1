$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$stateDir = Join-Path $root '.bot_state'
$logPath = Join-Path $stateDir 'manual-start.log'
& (Join-Path $PSScriptRoot 'stop-bot.ps1')

Write-Host ''
Write-Host 'Iniciando bot...'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
Set-Content -LiteralPath $logPath -Encoding utf8 -Value "Inicio do bot: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$powerShell = (Get-Command pwsh -ErrorAction SilentlyContinue).Source

if (-not $powerShell) {
  $powerShell = (Get-Command powershell -ErrorAction Stop).Source
}

$escapedRoot = $root.Path.Replace("'", "''")
$escapedLogPath = $logPath.Replace("'", "''")
$command = @"
Set-Location -LiteralPath '$escapedRoot'
`$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = `$OutputEncoding
npm.cmd start 2>&1 | ForEach-Object {
  `$_ | Out-File -LiteralPath '$escapedLogPath' -Encoding utf8 -Append
}
"@

Start-Process `
  -FilePath $powerShell `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) `
  -WindowStyle Hidden

Write-Host "Bot iniciado em segundo plano."
Write-Host "Log: $logPath"

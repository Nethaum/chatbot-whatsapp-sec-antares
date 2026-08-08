$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$stateDir = Join-Path $root '.bot_state'
$logPath = Join-Path $stateDir 'watchdog.log'
$indexPath = Join-Path $root 'src\index.js'
$sessionPath = Join-Path $root '.wwebjs_auth\session-clube'

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

function Write-Log([string]$message) {
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $logPath -Value "[$timestamp] $message"
}

if (-not (Test-Path -LiteralPath $sessionPath)) {
  exit 0
}

$escapedIndexPath = [regex]::Escape($indexPath)
$escapedRoot = [regex]::Escape($root)
$nodeProcesses = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue
$running = $false

foreach ($nodeProcess in $nodeProcesses) {
  $commandLine = [string]$nodeProcess.CommandLine

  if ($commandLine -match $escapedIndexPath -or ($commandLine -match $escapedRoot -and $commandLine -match 'src[\\/]+index\.js')) {
    $running = $true
    break
  }
}

if ($running) {
  exit 0
}

Write-Log 'Bot nao esta em execucao. Reiniciando automaticamente.'

$restartPath = Join-Path $PSScriptRoot 'restart-bot.ps1'
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source

& $powershellPath -NoProfile -ExecutionPolicy Bypass -File $restartPath *>> $logPath

Write-Log 'Reinicio solicitado pelo watchdog.'

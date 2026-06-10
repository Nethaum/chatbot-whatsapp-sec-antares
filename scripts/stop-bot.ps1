$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$lockPath = Join-Path $root '.bot_state\bot.lock'
$indexPath = Join-Path $root 'src\index.js'
$pidsToStop = New-Object 'System.Collections.Generic.HashSet[int]'

if (Test-Path -LiteralPath $lockPath) {
  $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
  if ($lock.pid) {
    [void]$pidsToStop.Add([int]$lock.pid)
  }
}

$escapedIndexPath = [regex]::Escape($indexPath)
$escapedRoot = [regex]::Escape($root)
$nodeProcesses = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue

foreach ($nodeProcess in $nodeProcesses) {
  $commandLine = [string]$nodeProcess.CommandLine

  if ($commandLine -match $escapedIndexPath -or ($commandLine -match $escapedRoot -and $commandLine -match 'src[\\/]+index\.js')) {
    [void]$pidsToStop.Add([int]$nodeProcess.ProcessId)
  }
}

if ($pidsToStop.Count -eq 0) {
  Write-Host 'Nenhum bot em execução encontrado.'
} else {
  foreach ($pidToStop in $pidsToStop) {
    $process = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue

    if ($process) {
      Write-Host "Parando bot no processo $pidToStop..."
      Stop-Process -Id $pidToStop -Force
    } else {
      Write-Host "Processo $pidToStop não está mais ativo."
    }
  }

  Start-Sleep -Seconds 2
}

if (Test-Path -LiteralPath $lockPath) {
  Remove-Item -LiteralPath $lockPath -Force
}

Write-Host 'Bot parado.'

$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Atualizar Lista de Socios'
$launcherPath = Join-Path $PSScriptRoot 'update-members-cache.ps1'
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$taskRun = "`"$powershellPath`" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""

& schtasks.exe /Create /TN $taskName /TR $taskRun /SC MONTHLY /D 25 /ST 08:00 /RL LIMITED /F | Out-Null

Write-Host "Atualizacao mensal instalada: $taskName"
Write-Host 'Agenda: todo dia 25 as 08:00.'
Write-Host 'Log: .bot_state\members-update.log'

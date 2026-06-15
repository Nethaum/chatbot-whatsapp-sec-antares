$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Chatbot WhatsApp'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$launcherPath = Join-Path $PSScriptRoot 'start-bot-at-logon.ps1'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""

$action = New-ScheduledTaskAction `
  -Execute $powershellPath `
  -Argument $arguments `
  -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Inicia automaticamente o chatbot WhatsApp da SEC Antares no login do Windows.' `
  -Force | Out-Null

Write-Host "Inicializacao automatica instalada: $taskName"
Write-Host 'O bot sera iniciado automaticamente no proximo login do Windows.'
Write-Host 'Para iniciar agora, use: npm.cmd start'

$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Chatbot WhatsApp (Watchdog)'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$watchdogPath = Join-Path $PSScriptRoot 'watchdog.ps1'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$watchdogPath`""

$action = New-ScheduledTaskAction `
  -Execute $powershellPath `
  -Argument $arguments `
  -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Verifica a cada 10 minutos se o chatbot WhatsApp da SEC Antares esta em execucao e reinicia automaticamente se necessario.' `
  -Force | Out-Null

Write-Host "Watchdog instalado: $taskName"
Write-Host 'O bot sera verificado a cada 10 minutos e reiniciado automaticamente se nao estiver rodando.'
Write-Host 'Log: .bot_state\watchdog.log'

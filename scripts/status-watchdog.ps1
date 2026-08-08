$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Chatbot WhatsApp (Watchdog)'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
  Write-Host 'Watchdog: NAO INSTALADO'
  exit 1
}

$info = Get-ScheduledTaskInfo -TaskName $taskName

Write-Host 'Watchdog: INSTALADO'
Write-Host "Estado: $($task.State)"
Write-Host "Ultima execucao: $($info.LastRunTime)"
Write-Host "Resultado da ultima execucao: $($info.LastTaskResult)"
Write-Host "Proxima execucao: $($info.NextRunTime)"

$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Chatbot WhatsApp'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
  Write-Host 'Inicializacao automatica: NAO INSTALADA'
  exit 1
}

$info = Get-ScheduledTaskInfo -TaskName $taskName

Write-Host 'Inicializacao automatica: INSTALADA'
Write-Host "Estado: $($task.State)"
Write-Host "Ultima execucao: $($info.LastRunTime)"
Write-Host "Resultado da ultima execucao: $($info.LastTaskResult)"
Write-Host 'Proxima execucao: no proximo login do Windows'

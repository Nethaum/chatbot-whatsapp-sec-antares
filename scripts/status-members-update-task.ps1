$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Atualizar Lista de Socios'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
  Write-Host 'Atualizacao mensal da lista de socios: NAO INSTALADA'
  exit 1
}

$info = Get-ScheduledTaskInfo -TaskName $taskName

Write-Host 'Atualizacao mensal da lista de socios: INSTALADA'
Write-Host "Estado: $($task.State)"
Write-Host "Ultima execucao: $($info.LastRunTime)"
Write-Host "Resultado da ultima execucao: $($info.LastTaskResult)"
Write-Host "Proxima execucao: $($info.NextRunTime)"

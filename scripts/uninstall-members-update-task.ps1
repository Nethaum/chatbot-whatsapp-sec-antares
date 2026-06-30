$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Atualizar Lista de Socios'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
  Write-Host 'A atualizacao mensal da lista de socios nao esta instalada.'
  exit 0
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host 'Atualizacao mensal da lista de socios removida.'

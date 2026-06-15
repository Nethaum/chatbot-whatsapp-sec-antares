$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Chatbot WhatsApp'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
  Write-Host 'A inicializacao automatica nao esta instalada.'
  exit 0
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host 'Inicializacao automatica removida.'

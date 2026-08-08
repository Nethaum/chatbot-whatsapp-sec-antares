$ErrorActionPreference = 'Stop'

$taskName = 'SEC Antares - Chatbot WhatsApp (Watchdog)'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
  Write-Host 'O watchdog nao esta instalado.'
  exit 0
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host 'Watchdog removido.'

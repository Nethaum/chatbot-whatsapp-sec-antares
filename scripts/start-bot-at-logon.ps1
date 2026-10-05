$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$stateDir = Join-Path $root '.bot_state'
$logPath = Join-Path $stateDir 'autostart.log'
$sessionPath = Join-Path $root '.wwebjs_auth\session-clube'

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
Set-Location $root

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

Add-Content -LiteralPath $logPath -Value "[$startedAt] Iniciando o chatbot da SEC Antares."

if (-not (Test-Path -LiteralPath $sessionPath)) {
  Add-Content -LiteralPath $logPath -Value "Sessao do WhatsApp nao encontrada. Inicie manualmente e escaneie o QR Code com o celular oficial da secretaria."
  exit 1
}

try {
  # Redireciona pelo cmd.exe: com $ErrorActionPreference = 'Stop', qualquer linha que o
  # Node escreva no stderr (console.warn/error) viraria erro terminante do PowerShell e
  # derrubaria o bot. O cmd.exe tambem grava o log em texto simples (sem UTF-16).
  $cmdLine = '"{0}" start >> "{1}" 2>&1' -f $npm, $logPath
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = 'cmd.exe'
  $startInfo.Arguments = '/d /s /c "' + $cmdLine + '"'
  $startInfo.WorkingDirectory = $root.Path
  $startInfo.UseShellExecute = $false
  $process = [System.Diagnostics.Process]::Start($startInfo)
  $process.WaitForExit()
  $exitCode = $process.ExitCode
} catch {
  Add-Content -LiteralPath $logPath -Value "Erro ao iniciar o bot: $($_.Exception.Message)"
  $exitCode = 1
}

$finishedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -LiteralPath $logPath -Value "[$finishedAt] Processo encerrado com codigo $exitCode."
exit $exitCode

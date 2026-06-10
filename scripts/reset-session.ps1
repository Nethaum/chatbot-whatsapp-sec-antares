$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
& (Join-Path $PSScriptRoot 'stop-bot.ps1')

$targets = @(
  (Join-Path $root '.wwebjs_auth\session-clube'),
  (Join-Path $root '.wwebjs_cache')
)

foreach ($target in $targets) {
  if (-not (Test-Path -LiteralPath $target)) {
    continue
  }

  $resolvedTarget = Resolve-Path -LiteralPath $target

  if (-not $resolvedTarget.Path.StartsWith($root.Path)) {
    throw "Caminho inesperado para remoção: $($resolvedTarget.Path)"
  }

  Write-Host "Removendo $($resolvedTarget.Path)..."
  Remove-Item -LiteralPath $resolvedTarget.Path -Recurse -Force
}

Write-Host ''
Write-Host 'Sessão removida. Iniciando bot para gerar novo QR Code...'
Set-Location $root
npm.cmd start

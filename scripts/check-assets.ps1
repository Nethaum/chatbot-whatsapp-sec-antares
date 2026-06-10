$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$clubPath = Join-Path $root 'data\club.json'
$club = Get-Content -LiteralPath $clubPath -Raw | ConvertFrom-Json
$items = @()

if ($club.membership.images) {
  $items += $club.membership.images
}

if ($club.membership.attachments) {
  $items += $club.membership.attachments
}

$missing = @()

foreach ($item in $items) {
  $relativePath = if ($item.path) { $item.path } else { [string]$item }
  $fullPath = Join-Path $root $relativePath

  if (Test-Path -LiteralPath $fullPath) {
    Write-Host "OK: $relativePath"
  } else {
    Write-Host "FALTANDO: $relativePath"
    $missing += $relativePath
  }
}

if ($missing.Count -gt 0) {
  Write-Host ''
  Write-Host 'Coloque os arquivos faltantes nos caminhos acima para que o bot envie as midias.'
  exit 1
}

Write-Host ''
Write-Host 'Todos os anexos configurados foram encontrados.'

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
& (Join-Path $PSScriptRoot 'stop-bot.ps1')

Write-Host ''
Write-Host 'Iniciando bot...'
Set-Location $root
npm.cmd start

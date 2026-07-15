$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$stateDir = Join-Path $root '.bot_state'
$logPath = Join-Path $stateDir 'autostart.log'
$sessionPath = Join-Path $root '.wwebjs_auth\session-clube'
$legacySessionPhonesPath = Join-Path $stateDir 'legacy-session-phones.txt'
$officialPhone = '+55 47 9702-2875'

function Test-ByteSequence {
  param(
    [byte[]]$Source,
    [byte[]]$Needle
  )

  if ($Needle.Length -eq 0 -or $Source.Length -lt $Needle.Length) {
    return $false
  }

  $limit = $Source.Length - $Needle.Length

  for ($index = 0; $index -le $limit; $index += 1) {
    if ($Source[$index] -ne $Needle[0]) {
      continue
    }

    $matched = $true

    for ($offset = 1; $offset -lt $Needle.Length; $offset += 1) {
      if ($Source[$index + $offset] -ne $Needle[$offset]) {
        $matched = $false
        break
      }
    }

    if ($matched) {
      return $true
    }
  }

  return $false
}

function Get-PhoneNeedles {
  param([string[]]$Phones)

  foreach ($phone in $Phones) {
    Write-Output -NoEnumerate ([System.Text.Encoding]::ASCII.GetBytes($phone))
    Write-Output -NoEnumerate ([System.Text.Encoding]::Unicode.GetBytes($phone))
  }
}

function Get-SessionSearchPaths {
  param([string]$SessionPath)

  @(
    (Join-Path $SessionPath 'Default\Local Storage'),
    (Join-Path $SessionPath 'Default\IndexedDB'),
    (Join-Path $SessionPath 'Default\Session Storage')
  ) | Where-Object { Test-Path -LiteralPath $_ }
}

function Get-LegacySessionPhones {
  $phones = @()

  if ($env:LEGACY_SESSION_PHONES) {
    $phones += $env:LEGACY_SESSION_PHONES -split '[,;\s]+'
  }

  if (Test-Path -LiteralPath $legacySessionPhonesPath) {
    $phones += Get-Content -LiteralPath $legacySessionPhonesPath
  }

  $phones |
    ForEach-Object { [string]$_ -replace '\D', '' } |
    Where-Object { $_ } |
    Sort-Object -Unique
}

function Test-SessionContainsPhone {
  param(
    [string]$SessionPath,
    [string[]]$Phones
  )

  $needles = @(Get-PhoneNeedles $Phones)
  $searchPaths = @(Get-SessionSearchPaths $SessionPath)

  foreach ($searchPath in $searchPaths) {
    foreach ($file in Get-ChildItem -LiteralPath $searchPath -Recurse -File -ErrorAction SilentlyContinue) {
      try {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
      } catch {
        continue
      }

      foreach ($needle in $needles) {
        if (Test-ByteSequence -Source $bytes -Needle $needle) {
          return $true
        }
      }
    }
  }

  return $false
}

New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
Set-Location $root

$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$startedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

Add-Content -LiteralPath $logPath -Value "[$startedAt] Iniciando o chatbot da SEC Antares."

if (-not (Test-Path -LiteralPath $sessionPath)) {
  Add-Content -LiteralPath $logPath -Value "Sessao do WhatsApp nao encontrada. Inicie manualmente e escaneie o QR Code com o celular oficial da secretaria: $officialPhone."
  exit 1
}

$legacySessionPhones = @(Get-LegacySessionPhones)

if ($legacySessionPhones.Count -gt 0 -and (Test-SessionContainsPhone -SessionPath $sessionPath -Phones $legacySessionPhones)) {
  Add-Content -LiteralPath $logPath -Value "Sessao antiga do numero de teste detectada. Execute npm.cmd run reset-session e escaneie o QR Code com o celular oficial da secretaria: $officialPhone."
  exit 1
}

try {
  & $npm start *>> $logPath
  $exitCode = $LASTEXITCODE
} catch {
  Add-Content -LiteralPath $logPath -Value "Erro ao iniciar o bot: $($_.Exception.Message)"
  $exitCode = 1
}

$finishedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -LiteralPath $logPath -Value "[$finishedAt] Processo encerrado com codigo $exitCode."
exit $exitCode

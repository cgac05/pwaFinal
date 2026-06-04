Param(
  [int[]]$PortsToClean = @(3000, 5173, 5174, 5175)
)

$ErrorActionPreference = "Stop"

function Get-ListeningPidsByPort {
  Param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
    return $connections | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
  }
  catch {
    $lines = netstat -ano -p TCP | Select-String -Pattern (":$Port\s")
    $pids = @()

    foreach ($line in $lines) {
      $text = ($line.Line -replace "\s+", " ").Trim()
      $parts = $text.Split(" ")

      if ($parts.Count -lt 5) {
        continue
      }

      $state = $parts[3]
      $pidText = $parts[4]

      if ($state -ne "LISTENING") {
        continue
      }

      $parsedPid = 0
      if (-not [int]::TryParse($pidText, [ref]$parsedPid)) {
        continue
      }

      $pids += $parsedPid
    }

    return $pids | Sort-Object -Unique
  }
}

function Stop-ProcessTree {
  Param([int]$ProcessId)

  if ($ProcessId -le 0) {
    return
  }

  try {
    & taskkill /PID $ProcessId /T /F | Out-Null
    Write-Host "[stop] Closed process tree rooted at PID $ProcessId"
  }
  catch {
    try {
      Stop-Process -Id $ProcessId -Force -ErrorAction Stop
      Write-Host "[stop] Closed PID $ProcessId"
    }
    catch {
      Write-Warning "[stop] Could not close PID ${ProcessId}: $($_.Exception.Message)"
    }
  }
}

function Stop-ManagedDevProcesses {
  Param([string]$RegistryPath)

  if (-not (Test-Path $RegistryPath)) {
    return
  }

  try {
    $registry = Get-Content -Path $RegistryPath -Raw | ConvertFrom-Json
  }
  catch {
    Write-Warning "[stop] Could not read process registry ${RegistryPath}: $($_.Exception.Message)"
    return
  }

  foreach ($processId in @($registry.backendPid, $registry.frontendPid)) {
    if ($null -ne $processId) {
      Stop-ProcessTree -ProcessId ([int]$processId)
    }
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $repoRoot ".tmp-ai-drfic"
$processRegistry = Join-Path $logsDir "dev-processes.json"

Write-Host "[stop] Stopping managed dev processes..."
Stop-ManagedDevProcesses -RegistryPath $processRegistry

Write-Host "[stop] Cleaning remaining listeners on configured dev ports..."
foreach ($port in $PortsToClean) {
  $listeners = Get-ListeningPidsByPort -Port $port

  if (-not $listeners) {
    Write-Host "[stop] Port $port already free"
    continue
  }

  foreach ($listener in $listeners) {
    Stop-ProcessTree -ProcessId $listener
  }
}

if (Test-Path $processRegistry) {
  Remove-Item $processRegistry -Force
}

Write-Host "Done. Dev ports cleaned."

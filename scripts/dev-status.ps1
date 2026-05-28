Param(
  [int[]]$Ports = @(3000, 5173),
  [string]$HealthUrl = "http://localhost:3000/health",
  [int]$TailLines = 30,
  [string]$LogsDir = ".tmp-ai-drfic"
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

$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedLogsDir = Join-Path $repoRoot $LogsDir
$processRegistry = Join-Path $resolvedLogsDir "dev-processes.json"

Write-Host "== Service Health =="
try {
  $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 2
  if ($response.status -eq "ok") {
    Write-Host "health: UP ($HealthUrl)"
  }
  else {
    Write-Host "health: UNEXPECTED ($HealthUrl)"
    Write-Host "response: $($response | ConvertTo-Json -Compress)"
  }
}
catch {
  Write-Host "health: DOWN ($HealthUrl)"
}

Write-Host ""
Write-Host "== Port Status =="
foreach ($port in $Ports) {
  $pids = Get-ListeningPidsByPort -Port $port
  if (-not $pids) {
    Write-Host "port ${port}: DOWN"
    continue
  }

  Write-Host "port ${port}: UP (pid: $($pids -join ','))"
}

Write-Host ""
Write-Host "== Process Registry =="
if (Test-Path $processRegistry) {
  try {
    $registry = Get-Content -Path $processRegistry -Raw | ConvertFrom-Json
    Write-Host "registry: FOUND ($processRegistry)"
    Write-Host "backend pid: $($registry.backendPid)"
    Write-Host "frontend pid: $($registry.frontendPid)"
  }
  catch {
    Write-Host "registry: UNREADABLE ($processRegistry)"
  }
}
else {
  Write-Host "registry: MISSING"
}

Write-Host ""
Write-Host "== Recent Logs =="
if (-not (Test-Path $resolvedLogsDir)) {
  Write-Host "logs dir missing: $resolvedLogsDir"
  exit 0
}

$logFiles = @(
  "backend-dev.out.log",
  "backend-dev.err.log",
  "frontend-dev.out.log",
  "frontend-dev.err.log"
)

foreach ($logFile in $logFiles) {
  $logPath = Join-Path $resolvedLogsDir $logFile
  Write-Host ""
  Write-Host "-- $logFile --"

  if (-not (Test-Path $logPath)) {
    Write-Host "[missing] $logPath"
    continue
  }

  $lines = Get-Content -Path $logPath -Tail $TailLines -ErrorAction SilentlyContinue
  if (-not $lines) {
    Write-Host "[empty]"
    continue
  }

  $lines | Out-Host
}

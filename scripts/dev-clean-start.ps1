Param(
  [int[]]$PortsToClean = @(3000, 5173, 5174, 5175),
  [bool]$StreamLogs = $false
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
    Write-Host "[clean] Closed process tree rooted at PID $ProcessId"
  }
  catch {
    try {
      Stop-Process -Id $ProcessId -Force -ErrorAction Stop
      Write-Host "[clean] Closed process $ProcessId"
    }
    catch {
      Write-Warning "[clean] Could not stop PID ${ProcessId}: $($_.Exception.Message)"
    }
  }
}

function Stop-ListenersOnPorts {
  Param([int[]]$Ports)

  foreach ($port in $Ports) {
    $listeners = Get-ListeningPidsByPort -Port $port
    foreach ($listener in $listeners) {
      Stop-ProcessTree -ProcessId $listener
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
    Write-Warning "[clean] Could not read process registry ${RegistryPath}: $($_.Exception.Message)"
    return
  }

  foreach ($processId in @($registry.backendPid, $registry.frontendPid)) {
    if ($null -ne $processId) {
      Stop-ProcessTree -ProcessId ([int]$processId)
    }
  }
}

function Resolve-RedirectPath {
  Param([string]$TargetPath)

  if (-not (Test-Path $TargetPath)) {
    return $TargetPath
  }

  try {
    Remove-Item $TargetPath -Force
    return $TargetPath
  }
  catch {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $dir = Split-Path -Parent $TargetPath
    $base = [System.IO.Path]::GetFileNameWithoutExtension($TargetPath)
    $ext = [System.IO.Path]::GetExtension($TargetPath)
    $fallback = Join-Path $dir ("{0}-{1}{2}" -f $base, $timestamp, $ext)
    Write-Warning "[clean] File in use: $TargetPath. Using fallback log: $fallback"
    return $fallback
  }
}

function Start-DetachedProcess {
  Param(
    [string]$WorkingDirectory,
    [string]$Command,
    [string]$StdOutPath,
    [string]$StdErrPath
  )

  $stdoutResolved = Resolve-RedirectPath -TargetPath $StdOutPath
  $stderrResolved = Resolve-RedirectPath -TargetPath $StdErrPath

  $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/d", "/s", "/c", $Command -WorkingDirectory $WorkingDirectory -PassThru -RedirectStandardOutput $stdoutResolved -RedirectStandardError $stderrResolved

  return [PSCustomObject]@{
    Process = $process
    StdOutPath = $stdoutResolved
    StdErrPath = $stderrResolved
  }
}

function Wait-BackendHealth {
  Param(
    [string]$HealthUrl = "http://localhost:3000/health",
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 2
      if ($response.status -eq "ok") {
        return $true
      }
    }
    catch {
      # Keep polling until timeout.
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "projects/rest-api/inversions_api"
$frontendDir = Join-Path $repoRoot "projects/pwa/inversions_app"

if (-not (Test-Path $backendDir)) {
  throw "Backend directory not found: $backendDir"
}

if (-not (Test-Path $frontendDir)) {
  throw "Frontend directory not found: $frontendDir"
}

$logsDir = Join-Path $repoRoot ".tmp-ai-drfic"
if (-not (Test-Path $logsDir)) {
  New-Item -Path $logsDir -ItemType Directory | Out-Null
}

$processRegistry = Join-Path $logsDir "dev-processes.json"

Write-Host "[1/3] Cleaning occupied dev ports and managed processes..."
Stop-ManagedDevProcesses -RegistryPath $processRegistry
Stop-ListenersOnPorts -Ports $PortsToClean
if (Test-Path $processRegistry) {
  Remove-Item $processRegistry -Force
}

Write-Host "[2/3] Syncing development token to frontend .env.local..."
Push-Location $backendDir
try {
  npm run dev:token:sync | Out-Host
}
finally {
  Pop-Location
}

$combinedLog = Join-Path $logsDir "dev-combined.out.log"
$backendOutLog = Join-Path $logsDir "backend-dev.out.log"
$backendErrLog = Join-Path $logsDir "backend-dev.err.log"
$frontendOutLog = Join-Path $logsDir "frontend-dev.out.log"
$frontendErrLog = Join-Path $logsDir "frontend-dev.err.log"

if ($StreamLogs) {
  Write-Host "[3/3] Starting backend and frontend (interactive + log)..."
} else {
  Write-Host "[3/3] Starting backend and frontend (background + file logs)..."
}
Write-Host "- Backend: http://localhost:3000"
Write-Host "- Frontend: http://localhost:5173"
Write-Host "- Logs: $logsDir"
Write-Host ""
if ($StreamLogs) {
  Write-Host "StreamLogs=true: showing live process output in this terminal."
  Write-Host "Press Ctrl+C to stop both services."
} else {
  Write-Host "StreamLogs=false: services start in background and only write logs to disk."
}

$backendCommand = "cd /d $backendDir && npm run dev"
$frontendCommand = "pwsh -NoProfile -File scripts/dev-frontend-wait-backend.ps1"

if ($StreamLogs) {
  $combinedLogResolved = Resolve-RedirectPath -TargetPath $combinedLog
  $concurrentlyArgs = @(
    "concurrently",
    "--raw",
    "--kill-others-on-fail",
    "--names", "backend,frontend",
    "--prefix", "[{name}]",
    "--prefix-colors", "blue,magenta",
    $backendCommand,
    $frontendCommand
  )

  & npx @concurrentlyArgs 2>&1 | Tee-Object -FilePath $combinedLogResolved
  exit $LASTEXITCODE
}

$backendStart = Start-DetachedProcess -WorkingDirectory $backendDir -Command "npm run dev" -StdOutPath $backendOutLog -StdErrPath $backendErrLog
$backendProcess = $backendStart.Process

if (-not (Wait-BackendHealth)) {
  Write-Error "Backend health did not become ready. Revisa $($backendStart.StdOutPath) y $($backendStart.StdErrPath)"
  Stop-ProcessTree -ProcessId $backendProcess.Id
  exit 1
}

$frontendStart = Start-DetachedProcess -WorkingDirectory $repoRoot -Command "pwsh -NoProfile -File scripts/dev-frontend-wait-backend.ps1" -StdOutPath $frontendOutLog -StdErrPath $frontendErrLog
$frontendProcess = $frontendStart.Process

$registryPayload = [ordered]@{
  backendPid = $backendProcess.Id
  frontendPid = $frontendProcess.Id
  backendOutLog = $backendStart.StdOutPath
  backendErrLog = $backendStart.StdErrPath
  frontendOutLog = $frontendStart.StdOutPath
  frontendErrLog = $frontendStart.StdErrPath
  startedAt = (Get-Date).ToString("o")
}
$registryPayload | ConvertTo-Json -Depth 4 | Set-Content -Path $processRegistry -Encoding UTF8

Write-Host ""
Write-Host "Started in background:"
Write-Host "- Backend PID: $($backendProcess.Id)"
Write-Host "- Frontend PID: $($frontendProcess.Id)"
Write-Host "- Registry: $processRegistry"
Write-Host "- Backend log: $($backendStart.StdOutPath)"
Write-Host "- Frontend log: $($frontendStart.StdOutPath)"
Write-Host "- Enable live logs with: npm run dev:clean-start:logs"

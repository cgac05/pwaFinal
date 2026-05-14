Param(
  [int[]]$PortsToClean = @(3000, 5173, 5174, 5175)
)

$ErrorActionPreference = "Stop"

foreach ($port in $PortsToClean) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

  if (-not $listeners) {
    Write-Host "[stop] Port $port already free"
    continue
  }

  foreach ($listener in $listeners) {
    try {
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
      Write-Host "[stop] Closed PID $($listener.OwningProcess) on port $port"
    }
    catch {
      Write-Warning "[stop] Could not close PID $($listener.OwningProcess) on port ${port}: $($_.Exception.Message)"
    }
  }
}

Write-Host "Done. Dev ports cleaned."

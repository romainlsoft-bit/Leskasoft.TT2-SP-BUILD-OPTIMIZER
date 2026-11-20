# Offline TT2 verification. Does NOT contact GitHub, create PRs,
# invoke GitHub Actions, or deploy the site.
# Usage: pwsh -File scripts/Verify-TT2-Offline.ps1
#        pwsh -File scripts/Verify-TT2-Offline.ps1 -Benchmark -SkillPoints 22600
[CmdletBinding()]
param(
    [switch]$Benchmark,
    [ValidateRange(0,50000)][int]$SkillPoints = 22600
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js >=22 is required. Install it locally before verification."
}
$version = (& node --version).TrimStart("v")
if ([int]($version.Split(".")[0]) -lt 22) {
    throw "Node.js >=22 is required; detected $version."
}
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
if (-not $npm) { throw "npm is not available on PATH." }

Push-Location $root
try {
    Write-Host "TT2 offline unit/regression tests (no GitHub Actions)..."
    & $npm.Source test
    if ($LASTEXITCODE -ne 0) { throw "TT2 unit tests failed (exit $LASTEXITCODE)." }

    Write-Host "TT2 local game source catalog parity..."
    & $npm.Source run check:data
    if ($LASTEXITCODE -ne 0) { throw "TT2 data checks failed (exit $LASTEXITCODE)." }

    Write-Host "TT2 offline browser ESM graph and syntax..."
    & $npm.Source run check:modules
    if ($LASTEXITCODE -ne 0) { throw "TT2 module graph verification failed (exit $LASTEXITCODE)." }

    if ($Benchmark) {
        Write-Host "TT2 local 18-route SP benchmark: $SkillPoints SP..."
        & $npm.Source run bench:22k -- --sp $SkillPoints
        if ($LASTEXITCODE -ne 0) { throw "TT2 benchmark failed (exit $LASTEXITCODE)." }
    }
    Write-Host "TT2 local verification passed. No GitHub workflow or deploy was requested."
} finally {
    Pop-Location
}

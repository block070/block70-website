# Copy Block70 project to Google Drive (everything you need to continue on another PC)
# Destination: G:\My Drive\block70project
# Run from project root: .\copy-to-google-drive.ps1

$ErrorActionPreference = "Stop"

# Source = folder where this script lives (project root)
$Source = $PSScriptRoot
$Dest   = "G:\My Drive\block70project"

if (-not (Test-Path $Source)) {
    Write-Error "Source not found: $Source"
    exit 1
}

if (-not (Test-Path "G:\")) {
    Write-Error "G: drive (Google Drive) not found. Is Google Drive running and set to G:?"
    exit 1
}

# Create destination root
$null = New-Item -ItemType Directory -Path $Dest -Force

Write-Host "Copying Block70 project to Google Drive..." -ForegroundColor Cyan
Write-Host "  From: $Source"
Write-Host "  To:   $Dest"
Write-Host ""

# Exclude: node_modules, .next, Python venv, caches, build artifacts.
# .env is excluded so secrets stay off cloud (copy manually to the other PC).
robocopy $Source $Dest /E /MT:8 /R:2 /W:5 `
    /XD "node_modules" ".next" ".venv" "venv" "__pycache__" ".pytest_cache" ".mypy_cache" "*.egg-info" ".turbo" `
    /XF ".env" "*.pyc" "*.pyo" "*.db" "*.sqlite" "*.sqlite3" `
    /NFL /NDL /NJH /NJS

# Robocopy exit codes: 0 = no files copied, 1 = files copied, 2+ = extra (e.g. mismatches)
$rc = $LASTEXITCODE
if ($rc -ge 8) {
    Write-Host ""
    Write-Host "Robocopy reported errors (exit code $rc)." -ForegroundColor Red
    exit $rc
}

Write-Host ""
Write-Host "Done. Project copied to: $Dest" -ForegroundColor Green
Write-Host ""
Write-Host "On the other computer:" -ForegroundColor Yellow
Write-Host "  1. Install Cursor, Node.js, and Python."
Write-Host "  2. Open the folder from Google Drive (or copy it off Drive first)."
Write-Host "  3. Copy your .env file manually (it was excluded for security)."
Write-Host "  4. Run: npm install (in apps/web) and pip install -r requirements.txt (in apps/api)."
Write-Host ""

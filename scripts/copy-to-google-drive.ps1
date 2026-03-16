# Copy Block70 project from C:\block70 to Google Drive
# Destination: G:\My Drive\block70project
# Run in PowerShell: .\scripts\copy-to-google-drive.ps1

$Source      = "C:\block70"
$Destination = "G:\My Drive\block70project"

# Set $SkipHeavy = $true to skip node_modules, .venv, __pycache__ (faster; reinstall on new PC)
$SkipHeavy = $false

if (-not (Test-Path $Source)) {
    Write-Error "Source not found: $Source"
    exit 1
}

$DriveG = Get-PSDrive -Name G -ErrorAction SilentlyContinue
if (-not $DriveG) {
    Write-Host "G: drive (Google Drive) not found. Is Google Drive for Desktop running and G: assigned?" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") { exit 1 }
}

$DestParent = Split-Path $Destination -Parent
if (-not (Test-Path $DestParent)) {
    Write-Error "Parent folder not found: $DestParent. Create 'block70project' under G:\My Drive or run: New-Item -ItemType Directory -Path '$Destination' -Force"
    exit 1
}

New-Item -ItemType Directory -Path $Destination -Force | Out-Null

Write-Host "Copying $Source -> $Destination" -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Gray

# Robocopy: /E = subdirs including empty, /DCOPY:DAT = copy data, /NFL/NDL = less log noise
# Exit codes 0-7 = success; 8+ = errors
if ($SkipHeavy) {
    & robocopy $Source $Destination /E /DCOPY:DAT /NFL /NDL /NJH /NJS `
        /XD node_modules __pycache__ .venv venv
} else {
    & robocopy $Source $Destination /E /DCOPY:DAT /NFL /NDL /NJH /NJS
}

if ($LASTEXITCODE -ge 8) {
    Write-Error "Robocopy reported errors (exit $LASTEXITCODE). Check destination."
    exit 1
}

Write-Host "Done. Project copied to: $Destination" -ForegroundColor Green
Write-Host "Next: On your new computer, open the folder from Google Drive and follow scripts\NEXT-STEPS-NEW-COMPUTER.md" -ForegroundColor Cyan

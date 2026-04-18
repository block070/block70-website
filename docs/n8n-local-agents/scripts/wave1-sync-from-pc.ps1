#Requires -Version 5.1
<#
.SYNOPSIS
  Uploads Wave 1 workflow JSON from this repo to the n8n host and runs import on the server.

.PARAMETER Server
  n8n host IP or hostname (default: 192.168.0.164).

.PARAMETER User
  SSH user (default: jmiller).

.PARAMETER Container
  Docker container name for n8n (default: n8n). Passed to the host as N8N_CONTAINER.

.EXAMPLE
  cd C:\block70\docs\n8n-local-agents\scripts
  .\wave1-sync-from-pc.ps1

.EXAMPLE
  .\wave1-sync-from-pc.ps1 -Server 192.168.0.164 -Container n8n
#>

param(
  [string] $Server = "192.168.0.164",
  [string] $User = "jmiller",
  [string] $Container = "n8n"
)

$ErrorActionPreference = "Stop"

foreach ($cmd in @("ssh", "scp")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "Missing '$cmd'. Install OpenSSH Client: Windows Settings -> Apps -> Optional features -> OpenSSH Client."
  }
}

$ScriptsDir = $PSScriptRoot
$WorkflowsDir = Join-Path (Split-Path $ScriptsDir -Parent) "workflows"
$Files = @(
  "block70-error-logger.json",
  "block70-pilot-coin-gecko.json"
)

foreach ($name in $Files) {
  $p = Join-Path $WorkflowsDir $name
  if (-not (Test-Path -LiteralPath $p)) {
    throw "Missing file: $p"
  }
}

$remoteWorkflows = "/home/jmiller/n8n_workspace/workflows"
$remoteScripts = "/home/jmiller/n8n_workspace/scripts"
$importSh = Join-Path $ScriptsDir "wave1-import-on-host.sh"

if (-not (Test-Path -LiteralPath $importSh)) {
  throw "Missing: $importSh"
}

$sshTarget = "${User}@${Server}"

Write-Host "Remote: ${sshTarget}"
Write-Host "Creating directories on host..."
& ssh $sshTarget "mkdir -p $remoteWorkflows $remoteScripts"

Write-Host "Uploading workflow JSON..."
foreach ($name in $Files) {
  $local = Join-Path $WorkflowsDir $name
  & scp $local "${sshTarget}:${remoteWorkflows}/"
}

Write-Host "Uploading wave1-import-on-host.sh..."
& scp $importSh "${sshTarget}:${remoteScripts}/"

Write-Host "Running import on host (docker exec)..."
# Run with `bash /path/script.sh` — no chmod (nested "bash -lc `"…`"" broke remote quoting and produced `chmod` with no operand).
$shPath = "${remoteScripts}/wave1-import-on-host.sh"
$remoteBash = "export N8N_CONTAINER=${Container}; bash ${shPath}"
& ssh $sshTarget "bash -lc '$remoteBash'"

Write-Host "Done."

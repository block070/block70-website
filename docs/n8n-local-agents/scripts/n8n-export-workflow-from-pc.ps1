#Requires -Version 5.1
<#
.SYNOPSIS
  Exports one n8n workflow to the canonical server path via SSH + docker exec (no manual scp of JSON).

.PARAMETER WorkflowId
  UUID from the n8n URL when the workflow is open.

.PARAMETER AgentId
  Registry agent id (kebab-case). File written: /home/jmiller/n8n_workspace/workflows/<AgentId>.json

.EXAMPLE
  cd C:\block70\docs\n8n-local-agents\scripts
  .\n8n-export-workflow-from-pc.ps1 -WorkflowId 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' -AgentId 'crypto-data-collector'
#>

param(
  [Parameter(Mandatory)]
  [string] $WorkflowId,
  [Parameter(Mandatory)]
  [string] $AgentId,
  [string] $Server = "192.168.0.164",
  [string] $User = "jmiller",
  [string] $Container = "n8n"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "Missing 'ssh'. Install OpenSSH Client (Windows Settings -> Apps -> Optional features -> OpenSSH Client)."
}

if ($AgentId -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') {
  throw "AgentId must be kebab-case (e.g. crypto-data-collector)"
}

$out = "/home/jmiller/n8n_workspace/workflows/${AgentId}.json"
$sshTarget = "${User}@${Server}"
$remote = "docker exec -u node ${Container} n8n export:workflow --id=${WorkflowId} --output=${out}"

Write-Host "Exporting to ${sshTarget}:${out}"
& ssh $sshTarget "bash -lc `"$remote`""
Write-Host "Done. Verify: ssh ${sshTarget} `"ls -la ${out}`""

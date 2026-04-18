#Requires -Version 5.1
<#
.SYNOPSIS
  One command: uploads Wave 1 workflow JSON + runs remote import (no manual scp steps).
  Run from any directory, adjust path to your clone:
    powershell -ExecutionPolicy Bypass -File C:\block70\docs\n8n-local-agents\RUN-WAVE1-SYNC.ps1
#>
param(
  [string] $Server = "192.168.0.164",
  [string] $User = "jmiller",
  [string] $Container = "n8n"
)
$inner = Join-Path $PSScriptRoot "scripts\wave1-sync-from-pc.ps1"
& $inner @PSBoundParameters

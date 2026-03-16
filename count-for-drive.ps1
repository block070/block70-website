$root = "c:\block70"
$exclude = @("node_modules", ".next", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".turbo")
$files = 0
$dirs = 0
Get-ChildItem -Path $root -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  $skip = $false
  foreach ($e in $exclude) {
    if ($rel -like "*\$e\*" -or $rel -like "*\$e") { $skip = $true; break }
    if ($_.PSIsContainer -and $_.Name -eq $e) { $skip = $true; break }
    if (-not $_.PSIsContainer -and $rel -like "*\$e\*") { $skip = $true; break }
  }
  if (-not $skip) {
    if ($_.PSIsContainer) { $dirs++ } else { $files++ }
  }
}
Write-Output "Files: $files"
Write-Output "Folders: $dirs"
Write-Output "Total: $($files + $dirs)"

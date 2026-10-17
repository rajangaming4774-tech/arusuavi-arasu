# Pulls the current site's images into assets-src/ so they can be optimized.
param([string]$ListFile = "scripts/asset-list.txt")
$dest = "assets-src"
New-Item -ItemType Directory -Force $dest | Out-Null
Get-Content $ListFile | Where-Object { $_ -match '\S' } | ForEach-Object {
  $url = $_.Trim()
  $name = [System.Uri]::UnescapeDataString(($url -split '/')[-1]) -replace '\s+', '-'
  $folder = ($url -split '/')[-2]
  if ($folder -eq 'images') { $name = "x-$name" }
  $out = Join-Path $dest $name
  if (-not (Test-Path $out)) {
    try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -TimeoutSec 60 } catch { Write-Warning "Failed: $url" }
  }
}
Get-ChildItem $dest | Measure-Object -Property Length -Sum | ForEach-Object { "{0} files, {1:N1} MB" -f $_.Count, ($_.Sum / 1MB) }

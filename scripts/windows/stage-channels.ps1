# Stage exactly the hash-verified installers declared in component release indexes.
# Never builds the newest sources or installs anything into the Desktop profile.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if ($env:GITHUB_ACTIONS -ne 'true' -or
    $env:GITHUB_REPOSITORY -notin @('OttoBlues/dsh-plugins', 'OttoBlues/dsh-hud-plugin') -or
    $env:GITHUB_REF -ne 'refs/heads/main' -or
    -not [string]::IsNullOrWhiteSpace($env:DSH_HOME)) {
  throw 'Only the vetted main Runner with default DSH_HOME may stage installers.'
}
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$base = Join-Path $env:USERPROFILE '.dsh\component-updates'
New-Item -ItemType Directory -Path $base -Force | Out-Null
$catalog = [ordered]@{ schema = 2; components = @() }
$archives = 0

foreach ($directory in Get-ChildItem -LiteralPath (Join-Path $root 'plugins') -Directory) {
  $name = $directory.Name
  $manifest = Get-Content -LiteralPath (Join-Path $directory.FullName 'package.json') -Raw | ConvertFrom-Json
  foreach ($channel in @('released', 'unstable')) {
    $index = Get-Content -LiteralPath (Join-Path $directory.FullName ($channel + '\index.json')) -Raw | ConvertFrom-Json
    if ($index.schema -ne 1 -or $index.component -ne $name -or
        $index.package -ne $manifest.name -or $index.channel -ne $channel) {
      throw 'Invalid component channel index.'
    }
    foreach ($entry in @($index.releases)) {
      $version = [string]$entry.version
      if ($version -notmatch '^\d+\.\d+\.\d+$' -or
          $entry.file -ne ('v' + $version + '/local-dsh-' + $name + '-' + $version + '.tgz') -or
          [string]$entry.sha256 -notmatch '^[a-f0-9]{64}$') {
        throw 'Invalid component channel installer descriptor.'
      }
      $source = Join-Path $directory.FullName ($channel + '\' + $entry.file.Replace('/', '\'))
      if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Missing declared installation archive.' }
      $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($hash -ne [string]$entry.sha256) { throw 'Archive hash mismatch.' }
      $destDir = Join-Path $base ('packages\' + $channel + '\' + $name + '\v' + $version)
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      $dest = Join-Path $destDir ('local-dsh-' + $name + '-' + $version + '.tgz')
      $tmp = $dest + '.tmp'
      Copy-Item -LiteralPath $source -Destination $tmp -Force
      if ((Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) {
        throw 'Staged archive hash mismatch.'
      }
      Move-Item -LiteralPath $tmp -Destination $dest -Force
      $catalog.components += [ordered]@{
        name = [string]$manifest.name
        channel = $channel
        version = $version
        commit = [string]$entry.sourceCommit
        sha256 = [string]$entry.sha256
      }
      $archives++
    }
  }
}
$catalogPath = Join-Path $base 'catalog.json'
$tmpCatalog = Join-Path $base ('catalog-' + [Guid]::NewGuid().ToString('N') + '.tmp')
$catalog | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $tmpCatalog -Encoding UTF8
Move-Item -LiteralPath $tmpCatalog -Destination $catalogPath -Force
Write-Host ('[PASSED] staged: ' + $archives + ' explicit release archive(s); no source was packed.')

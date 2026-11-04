# Read-only Windows Desktop HUD auto-upgrade probe.
# Reports whether a tested version may be installed; never changes the Desktop profile.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$reportDir = Join-Path $root 'auto-results'
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
$report = [ordered]@{
  schema = 1
  operation = 'auto-upgrade-probe'
  target = 'desktop'
  created_utc = (Get-Date).ToUniversalTime().ToString('o')
  current_version = $null
  target_version = $null
  state = 'unknown'
  needed = $false
  checks = @()
}
$stage = 'runner'
$exitCode = 0
function Record([string] $Name, [string] $State, [string] $Message) {
  $report.checks += [ordered]@{ name = $Name; state = $State; message = $Message }
  Write-Host ('[{0}] {1}: {2}' -f $State.ToUpperInvariant(), $Name, $Message)
}
try {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:GITHUB_REPOSITORY -ne 'OttoBlues/dsh-plugins' -or $env:GITHUB_REF -ne 'refs/heads/main') {
    throw 'Only the approved main-branch Runner may run the auto-upgrade probe.'
  }
  if (-not [string]::IsNullOrWhiteSpace($env:DSH_HOME)) {
    throw 'The Runner uses an ambiguous DSH_HOME; refusing automatic upgrade.'
  }
  Record 'runner' 'passed' 'Trusted default-profile Runner environment.'

  $stage = 'desktop-cli'
  $dsh = Get-Command dsh -ErrorAction SilentlyContinue
  if ($null -eq $dsh -or [string]::IsNullOrWhiteSpace($dsh.Source)) { throw 'DSH CLI not found.' }
  $dshPath = [IO.Path]::GetFullPath($dsh.Source)
  if (-not $dshPath.EndsWith('\resources\runtime\cli\bin\dsh.cmd', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The available dsh is not the Desktop-bundled CLI.'
  }
  Record 'desktop-cli' 'passed' 'Desktop-bundled CLI is available.'

  $stage = 'profile'
  if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) { throw 'USERPROFILE not set.' }
  $profile = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'
  $profileManifestPath = Join-Path $profile 'package.json'
  if (-not (Test-Path -LiteralPath $profileManifestPath -PathType Leaf)) {
    throw 'Desktop profile is not initialized for this Runner account.'
  }
  $profileManifest = Get-Content -LiteralPath $profileManifestPath -Raw | ConvertFrom-Json
  if ($null -eq $profileManifest.dsh -or $null -eq $profileManifest.dsh.profile) {
    throw 'Invalid Desktop Profile manifest.'
  }
  $activeBundles = @($profileManifest.dsh.profile.bundles)
  if (-not ($activeBundles -contains '@local/dsh-hud')) {
    $report.state = 'not-installed'
    Record 'profile' 'skipped' 'HUD has been uninstalled; automation respects that choice.'
  } else {
    $stage = 'version'
    $targetManifest = Get-Content -LiteralPath (Join-Path $root 'plugins\hud\package.json') -Raw | ConvertFrom-Json
    $installedPath = Join-Path $profile 'node_modules\@local\dsh-hud\package.json'
    if (-not (Test-Path -LiteralPath $installedPath -PathType Leaf)) {
      throw 'HUD is listed but its installed package manifest is missing.'
    }
    $installedManifest = Get-Content -LiteralPath $installedPath -Raw | ConvertFrom-Json
    if ($targetManifest.name -ne '@local/dsh-hud' -or $installedManifest.name -ne '@local/dsh-hud') {
      throw 'Unexpected HUD package identity.'
    }
    $targetText = [string]$targetManifest.version
    $currentText = [string]$installedManifest.version
    if ($targetText -notmatch '^\d+\.\d+\.\d+$' -or $currentText -notmatch '^\d+\.\d+\.\d+$') {
      throw 'Automatic upgrade requires numeric X.Y.Z versions.'
    }
    $report.target_version = $targetText
    $report.current_version = $currentText
    $targetVersion = [version]$targetText
    $currentVersion = [version]$currentText

    if ($currentVersion -ge $targetVersion) {
      $report.state = 'current'
      Record 'version' 'passed' 'Installed version is current or newer; no update is needed.'
    } else {
      Record 'version' 'passed' ('New tested version available: ' + $currentText + ' to ' + $targetText + '.')
      $stage = 'desktop-process'
      $binDirectory = Split-Path -Path $dshPath -Parent
      $appRoot = [IO.Path]::GetFullPath((Join-Path $binDirectory '..\..\..\..'))
      $executableNames = @(Get-ChildItem -LiteralPath $appRoot -File -Filter '*.exe' |
        Where-Object { $_.Name -match '(?i)DeepSeek|Harness|DSH' } |
        ForEach-Object { $_.Name })
      if ($executableNames.Count -eq 0) { throw 'Desktop application executable could not be identified.' }
      $running = @(Get-CimInstance Win32_Process | Where-Object { $executableNames -contains $_.Name })
      if ($running.Count -gt 0) {
        $report.state = 'deferred'
        Record 'desktop-process' 'deferred' 'Desktop is running; keep current plugin until it exits.'
      } else {
        $report.state = 'ready'
        $report.needed = $true
        Record 'desktop-process' 'passed' 'Desktop is stopped; version upgrade may proceed.'
      }
    }
  }
} catch {
  $exitCode = 1
  $report.state = 'failed'
  Record $stage 'failed' 'Preflight failed. No personal paths or raw exceptions are uploaded.'
} finally {
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $reportDir 'probe.json') -Encoding UTF8
  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_OUTPUT)) {
    ('needed=' + ([string]$report.needed).ToLowerInvariant()) | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding ASCII
  }
  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_STEP_SUMMARY)) {
    $summary = @(
      '## Desktop HUD auto-upgrade check',
      '',
      ('State: **' + $report.state + '**'),
      ('Target: **' + $report.target_version + '**'),
      '',
      'The Desktop process is never terminated and a removed plugin is never silently reinstalled.'
    )
    $summary | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding UTF8
  }
}
exit $exitCode

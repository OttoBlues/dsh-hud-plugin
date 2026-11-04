# Windows Desktop HUD deployment, for a trusted, manually authorized repository-runner.
# This script deliberately refuses to install while the DSH Desktop application is running.
# It does not change DSH_HOME, terminate any user process, launch Desktop, or upload raw logs.
[CmdletBinding()]
param(
  [ValidateSet('check', 'install', 'upgrade', 'uninstall')]
  [string] $Mode = 'check',
  [ValidateSet('released', 'unstable')]
  [string] $Channel = 'released',
  [string] $TargetVersion = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$reportDirectory = Join-Path $repositoryRoot 'deploy-results'
if (Test-Path -LiteralPath $reportDirectory) {
  Remove-Item -LiteralPath $reportDirectory -Force -Recurse
}
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
$runTemp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$scratch = Join-Path $runTemp ('dsh-desktop-install-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch -Force | Out-Null

$report = [ordered]@{
  schema = 1
  mode = $Mode
  package = '@local/dsh-hud'
  target = 'desktop'
  revision = $env:GITHUB_SHA
  created_utc = (Get-Date).ToUniversalTime().ToString('o')
  overall = 'pending'
  checks = @()
}
$stage = 'environment'
$exitCode = 1
$script:dshCli = $null

function Record([string] $Name, [string] $State, [string] $Message) {
  $report.checks += [ordered]@{
    name = $Name
    state = $State
    message = $Message
  }
  Write-Host ('[{0}] {1}: {2}' -f $State.ToUpperInvariant(), $Name, $Message)
}

function Invoke-DshQuiet([string[]] $ArgsToPass, [string] $StageName) {
  $localLog = Join-Path $scratch ($StageName + '.log')
  & $script:dshCli @ArgsToPass *> $localLog
  if ($LASTEXITCODE -ne 0) {
    throw ('DSH CLI operation failed at ' + $StageName + ', exit ' + $LASTEXITCODE + '.')
  }
}

function Read-DesktopManifest([string] $ManifestPath) {
  return (Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json)
}

function Resolve-VettedHudPackage {
  $index = Read-DesktopManifest (Join-Path $repositoryRoot ('plugins\hud\' + $Channel + '\index.json'))
  if ($index.schema -ne 1 -or $index.component -ne 'hud' -or
      $index.package -ne '@local/dsh-hud' -or $index.channel -ne $Channel) {
    throw 'Invalid channel index.'
  }
  $version = if ($TargetVersion -ne '') { $TargetVersion } else { [string]$index.latest }
  if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'No installable version in channel.' }
  $releases = @($index.releases | Where-Object { $_.version -eq $version })
  if ($releases.Count -ne 1) { throw 'Requested version is not listed exactly once.' }
  $entry = $releases[0]
  $path = 'v' + $version + '/local-dsh-hud-' + $version + '.tgz'
  if ($entry.file -ne $path -or [string]$entry.sha256 -notmatch '^[a-f0-9]{64}$') {
    throw 'Installer descriptor invalid.'
  }
  $archive = Join-Path $repositoryRoot ('plugins\hud\' + $Channel + '\' + $path.Replace('/', '\'))
  if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw 'Reviewed archive absent.' }
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
    throw 'Reviewed archive SHA-256 mismatch.'
  }
  $base = Join-Path $env:USERPROFILE '.dsh\component-updates'
  if ($Channel -eq 'unstable') {
    $prefPath = Join-Path $base 'preferences.json'
    if (-not (Test-Path -LiteralPath $prefPath -PathType Leaf)) {
      throw 'Unstable updates are disabled.'
    }
    $prefs = Read-DesktopManifest $prefPath
    if ($prefs.schema -ne 1 -or $prefs.allowUnstable -ne $true) {
      throw 'Unstable updates are disabled.'
    }
  }
  if ($TargetVersion -ne '' -or $Channel -eq 'unstable') {
    $requestPath = Join-Path $base 'request.json'
    if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) {
      throw 'Explicit update request required.'
    }
    $request = Read-DesktopManifest $requestPath
    if ($request.schema -ne 2 -or $request.name -ne '@local/dsh-hud' -or
        $request.channel -ne $Channel -or $request.version -ne $version -or
        $request.commit -ne $entry.sourceCommit -or $request.sha256 -ne $entry.sha256) {
      throw 'Requested update differs from vetted channel package.'
    }
  }
  return @{ version = $version; bundle = $archive }
}

function Has-HudBundle($Manifest) {
  if ($null -eq $Manifest.dsh -or $null -eq $Manifest.dsh.profile) {
    throw 'The desktop profile lacks a valid DSH bundle manifest.'
  }
  return (@($Manifest.dsh.profile.bundles) -contains '@local/dsh-hud')
}

try {
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:GITHUB_REPOSITORY -ne 'OttoBlues/dsh-plugins' -or $env:GITHUB_REF -ne 'refs/heads/main') {
    throw 'This script may only execute in the trusted main-branch GitHub Actions runner.'
  }
  if (-not [string]::IsNullOrWhiteSpace($env:DSH_HOME)) {
    throw 'DSH_HOME is overridden; refusing to modify an ambiguous Desktop profile.'
  }
  Record 'environment' 'passed' 'Trusted repository, main branch, and default DSH home.'

  $stage = 'desktop-cli'
  $command = Get-Command dsh -ErrorAction SilentlyContinue
  if ($null -eq $command -or [string]::IsNullOrWhiteSpace($command.Source)) {
    throw 'DSH CLI is not available.'
  }
  $script:dshCli = [IO.Path]::GetFullPath($command.Source)
  $expected = '\resources\runtime\cli\bin\dsh.cmd'
  if (-not $script:dshCli.EndsWith($expected, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The current dsh command is not the installed Desktop-bundled dsh.cmd.'
  }
  & $script:dshCli --version *> (Join-Path $scratch 'version.log')
  if ($LASTEXITCODE -ne 0) { throw 'Desktop-bundled DSH CLI version probe failed.' }
  Record 'desktop-cli' 'passed' 'Verified the Desktop-bundled dsh.cmd (not an npm/Web CLI).'

  $stage = 'desktop-profile'
  if ([string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
    throw 'The Runner account has no USERPROFILE.'
  }
  $manifestPath = Join-Path $env:USERPROFILE '.dsh\profiles\desktop\package.json'
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'The Desktop profile is not initialized for this Runner account.'
  }
  $before = Read-DesktopManifest $manifestPath
  $wasInstalled = Has-HudBundle $before
  Record 'desktop-profile' 'passed' 'An existing Desktop-owned profile was found; no profile reset is needed.'

  $stage = 'desktop-process'
  $binDirectory = Split-Path -Path $script:dshCli -Parent
  $appRoot = [IO.Path]::GetFullPath((Join-Path $binDirectory '..\..\..\..'))
  $executables = @(Get-ChildItem -LiteralPath $appRoot -File -Filter '*.exe' |
    Where-Object { $_.Name -match '(?i)DeepSeek|Harness|DSH' })
  if ($executables.Count -eq 0) {
    throw 'Cannot identify the Desktop application executable; refusing an unsafe install.'
  }
  $names = @($executables | ForEach-Object { $_.Name })
  $active = @(Get-CimInstance Win32_Process |
    Where-Object { $names -contains $_.Name })
  if ($active.Count -gt 0) {
    Record 'desktop-process' 'warning' 'DSH Desktop is running. Close it via system tray before installation.'
    if ($Mode -ne 'check') {
      throw 'Desktop must be fully exited before plugin changes.'
    }
  } else {
    Record 'desktop-process' 'passed' 'DSH Desktop is not running; safe to manage the plugin.'
  }

  $stage = 'existing-state'
  if ($Mode -eq 'check') {
    if ($wasInstalled) {
      Record 'existing-state' 'passed' 'The HUD Bundle is already installed in the Desktop profile.'
    } else {
      Record 'existing-state' 'warning' 'The HUD Bundle is not installed in the Desktop profile.'
    }
    $report.overall = 'checked'
    $exitCode = 0
  } elseif ($Mode -eq 'install') {
    $stage = 'install'
    if ($wasInstalled) {
      Record 'install' 'passed' 'HUD Bundle already installed; no existing Desktop configuration modified.'
    } else {
      $release = Resolve-VettedHudPackage
      $bundle = $release.bundle
      Invoke-DshQuiet @('plugin', '--profile', 'desktop', 'add', $bundle) 'plugin-add'
      Record 'install' 'passed' 'Official Desktop CLI installed the tested HUD Bundle.'
    }
    $stage = 'verify'
    $after = Read-DesktopManifest $manifestPath
    if (-not (Has-HudBundle $after)) {
      throw 'Desktop profile manifest does not contain the HUD Bundle after install.'
    }
    Record 'verify' 'passed' 'Desktop profile now includes @local/dsh-hud.'
    $report.overall = 'installed'
    $exitCode = 0
  } elseif ($Mode -eq 'upgrade') {
    $stage = 'upgrade'
    if (-not $wasInstalled) { throw 'HUD is not installed; use install, not upgrade.' }
    $release = Resolve-VettedHudPackage
    $targetVersion = $release.version
    $bundle = $release.bundle
    $installedManifestPath = Join-Path (Split-Path -Path $manifestPath -Parent) 'node_modules\@local\dsh-hud\package.json'
    if (-not (Test-Path -LiteralPath $installedManifestPath -PathType Leaf)) {
      throw 'Cannot resolve the old HUD package manifest.'
    }
    $prior = Read-DesktopManifest $installedManifestPath
    if ($prior.name -ne '@local/dsh-hud' -or
        [string]$prior.version -notmatch '^\d+\.\d+\.\d+$' -or
        $targetVersion -notmatch '^\d+\.\d+\.\d+$') {
      throw 'Cannot verify HUD package identities and numeric SemVer versions.'
    }
    if ([version]$prior.version -ge [version]$targetVersion) {
      Record 'upgrade' 'passed' 'Already running the same or newer HUD; no package changes made.'
      $report.overall = 'already-current'
      $exitCode = 0
    } else {
      # Repackage a strict allowlist of prior installed HUD files into an npm-compatible
      # package/ tarball. This avoids npm pack lifecycle hooks, symlink traversal,
      # and PowerShell 5.1 interpreting npm notice stderr as a terminating error.
      # A failed rollback archive stops deployment before any Desktop mutation.
      $stage = 'backup'
      $tarCommand = Get-Command tar.exe -ErrorAction SilentlyContinue
      if ($null -eq $tarCommand) { throw 'Windows tar.exe unavailable; upgrade cancelled.' }
      $backupDir = Join-Path $scratch 'rollback'
      $stageRoot = Join-Path $scratch 'rollback-stage'
      $stagePackage = Join-Path $stageRoot 'package'
      New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
      New-Item -ItemType Directory -Path $stagePackage -Force | Out-Null
      $installedRoot = Split-Path -Path $installedManifestPath -Parent
      foreach ($entry in @('package.json', 'client.js', 'index.js', 'cordis.patch.yml', 'icon.svg')) {
        $from = Join-Path $installedRoot $entry
        if (-not (Test-Path -LiteralPath $from -PathType Leaf)) {
          throw ('Prior HUD required file missing: ' + $entry)
        }
        Copy-Item -LiteralPath $from -Destination (Join-Path $stagePackage $entry) -Force
      }
      $locale = Join-Path $installedRoot 'locale'
      if (-not (Test-Path -LiteralPath $locale -PathType Container)) {
        throw 'Prior HUD locale directory missing.'
      }
      Copy-Item -LiteralPath $locale -Destination $stagePackage -Recurse -Force
      $oldReadme = Join-Path $installedRoot 'README.md'
      if (Test-Path -LiteralPath $oldReadme -PathType Leaf) {
        Copy-Item -LiteralPath $oldReadme -Destination (Join-Path $stagePackage 'README.md') -Force
      }
      $rollback = Join-Path $backupDir 'dsh-hud-prior-rollback.tgz'
      & $tarCommand.Source -czf $rollback -C $stageRoot package 2>$null
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $rollback -PathType Leaf)) {
        throw 'Cannot archive the previous HUD version; upgrade cancelled.'
      }
      $tarEntries = @(& $tarCommand.Source -tzf $rollback 2>$null)
      if ($LASTEXITCODE -ne 0 -or -not ($tarEntries -contains 'package/package.json')) {
        throw 'Rollback archive structure is invalid; upgrade cancelled.'
      }
      Record 'backup' 'passed' 'Original HUD package archived locally for same-run rollback.'

      $stage = 'upgrade'
      try {
        Invoke-DshQuiet @('plugin', '--profile', 'desktop', 'add', $bundle) 'plugin-upgrade'
        $stage = 'verify-version'
        $after = Read-DesktopManifest $manifestPath
        if (-not (Has-HudBundle $after)) { throw 'HUD Bundle was removed during upgrade.' }
        $installed = Read-DesktopManifest $installedManifestPath
        if ($installed.name -ne '@local/dsh-hud' -or $installed.version -ne $targetVersion) {
          throw 'Installed HUD version does not match the requested upgrade.'
        }
        Record 'upgrade' 'passed' ('Official Desktop CLI now resolves @local/dsh-hud v' + $targetVersion + '.')
        Record 'verify-version' 'passed' 'Installed package name and exact target version verified.'
        $report.overall = 'upgraded'
        $exitCode = 0
      } catch {
        # Restore old version on any post-write error, without uploading raw logs.
        $stage = 'rollback'
        try {
          Invoke-DshQuiet @('plugin', '--profile', 'desktop', 'add', $rollback) 'plugin-rollback'
          $restored = Read-DesktopManifest $installedManifestPath
          if ($restored.name -ne '@local/dsh-hud' -or $restored.version -ne $prior.version) {
            throw 'Rollback result did not match the prior version.'
          }
          Record 'rollback' 'passed' 'Prior HUD version was restored after upgrade failure.'
        } catch {
          Record 'rollback' 'failed' 'Automated rollback failed; inspect DSH locally before next upgrade.'
        }
        throw 'HUD upgrade failed; rollback attempt completed.'
      }
    }
  } elseif ($Mode -eq 'uninstall') {
    $stage = 'uninstall'
    if ($wasInstalled) {
      Invoke-DshQuiet @('plugin', '--profile', 'desktop', 'remove', '@local/dsh-hud') 'plugin-remove'
      Record 'uninstall' 'passed' 'Official Desktop CLI removed the HUD Bundle.'
    } else {
      Record 'uninstall' 'passed' 'HUD Bundle was not installed; no change made.'
    }
    $stage = 'verify'
    $after = Read-DesktopManifest $manifestPath
    if (Has-HudBundle $after) {
      throw 'Desktop profile manifest still contains the HUD Bundle.'
    }
    Record 'verify' 'passed' 'Desktop profile does not include @local/dsh-hud.'
    $report.overall = 'uninstalled'
    $exitCode = 0
  }
} catch {
  $report.overall = 'failed'
  # Never print a raw CLI error, profile path, environment variable, or captured CLI log.
  Record $stage 'failed' 'Precondition or operation failed. Desktop was not force-closed. Check Runner/DSH configuration.'
} finally {
  try {
    Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction Stop
  } catch {
    $exitCode = 1
    $report.overall = 'failed'
    Record 'cleanup' 'failed' 'Local temporary CLI logs need manual removal on the Runner.'
  }

  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $reportDirectory 'desktop-deploy.json') -Encoding UTF8

  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_STEP_SUMMARY)) {
    $summary = @(
      '## DSH HUD · Desktop deployment',
      '',
      ('Operation: **' + $Mode + '** | Result: **' + $report.overall + '**'),
      '',
      '| Stage | Status | Result |',
      '| --- | --- | --- |'
    )
    foreach ($c in $report.checks) {
      $summary += ('| ' + $c.name + ' | ' + $c.state + ' | ' + $c.message.Replace('|', '/') + ' |')
    }
    $summary += ''
    $summary += 'The DSH Desktop application is not automatically launched or terminated. Reopen it manually to see the plugin.'
    $summary | Out-File -LiteralPath $env:GITHUB_STEP_SUMMARY -Append -Encoding UTF8
  }
}

exit $exitCode

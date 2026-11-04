# Read-only probe for a user-clicked component update request.
# It never downloads arbitrary source or upgrades without a matching channel index.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$resultDir = Join-Path $root 'auto-results'
New-Item -ItemType Directory -Path $resultDir -Force | Out-Null
$report = [ordered]@{
  schema = 2; component = 'hud'; state = 'unknown'
  current_version = $null; target_version = $null
  channel = $null; needed = $false
  checked_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$step = 'environment'
$exitCode = 0

try {
  if ($env:GITHUB_ACTIONS -ne 'true' -or
      $env:GITHUB_REPOSITORY -notin @('OttoBlues/dsh-plugins', 'OttoBlues/dsh-hud-plugin') -or
      $env:GITHUB_REF -ne 'refs/heads/main' -or
      -not [string]::IsNullOrWhiteSpace($env:DSH_HOME)) {
    throw 'Incorrect Runner environment.'
  }
  $step = 'request'
  $base = Join-Path $env:USERPROFILE '.dsh\component-updates'
  $requestPath = Join-Path $base 'request.json'
  if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) {
    $report.state = 'no-request'
    Write-Host '[SKIPPED] No confirmed update request was submitted from the Components tab.'
  } else {
    $request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json
    if ($request.schema -ne 2 -or $request.name -ne '@local/dsh-hud' -or
        [string]$request.version -notmatch '^\d+\.\d+\.\d+$' -or
        $request.channel -notin @('released', 'unstable') -or
        [string]$request.sha256 -notmatch '^[a-f0-9]{64}$' -or
        [string]$request.commit -notmatch '^[a-f0-9]{40}$') {
      throw 'Malformed update request.'
    }
    $channel = [string]$request.channel
    $version = [string]$request.version
    $step = 'channel-approval'
    if ($channel -eq 'unstable') {
      $prefsPath = Join-Path $base 'preferences.json'
      if (-not (Test-Path -LiteralPath $prefsPath -PathType Leaf)) {
        $report.state = 'experimental-disabled'
      } else {
        $prefs = Get-Content -LiteralPath $prefsPath -Raw | ConvertFrom-Json
        if ($prefs.schema -ne 1 -or $prefs.allowUnstable -ne $true) {
          $report.state = 'experimental-disabled'
        }
      }
    }
    if ($report.state -eq 'experimental-disabled') {
      Write-Host '[SKIPPED] Experimental updates are disabled in DSH component settings.'
    } else {
      $index = Get-Content -LiteralPath (Join-Path $root ('plugins\hud\' + $channel + '\index.json')) -Raw | ConvertFrom-Json
      if ($index.schema -ne 1 -or $index.channel -ne $channel -or
          $index.component -ne 'hud' -or $index.package -ne '@local/dsh-hud') {
        throw 'Invalid approved update channel.'
      }
      $item = @($index.releases | Where-Object { $_.version -eq $version })
      if ($item.Count -ne 1 -or $item[0].sourceCommit -ne $request.commit -or
          $item[0].sha256 -ne $request.sha256 -or
          $item[0].file -ne ('v' + $version + '/local-dsh-hud-' + $version + '.tgz')) {
        throw 'Update request does not match a reviewed release manifest.'
      }
      $archive = Join-Path $root ('plugins\hud\' + $channel + '\' + $item[0].file.Replace('/', '\'))
      if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
        throw 'Requested installable archive is missing.'
      }
      if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$item[0].sha256) {
        throw 'Requested archive failed SHA-256 verification.'
      }
      $step = 'desktop-state'
      $dsh = Get-Command dsh -ErrorAction SilentlyContinue
      if ($null -eq $dsh -or [string]::IsNullOrWhiteSpace($dsh.Source) -or
          -not $dsh.Source.EndsWith('\resources\runtime\cli\bin\dsh.cmd', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Desktop-installed DSH CLI was not found.'
      }
      $profile = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'
      $profileManifest = Get-Content -LiteralPath (Join-Path $profile 'package.json') -Raw | ConvertFrom-Json
      if (-not (@($profileManifest.dsh.profile.bundles) -contains '@local/dsh-hud')) {
        $report.state = 'not-installed'
        Write-Host '[SKIPPED] The user removed HUD; updater will not reinstall it.'
      } else {
        $installed = Get-Content -LiteralPath (Join-Path $profile 'node_modules\@local\dsh-hud\package.json') -Raw | ConvertFrom-Json
        if ($installed.name -ne '@local/dsh-hud' -or [string]$installed.version -notmatch '^\d+\.\d+\.\d+$') {
          throw 'Installed HUD manifest is invalid.'
        }
        $report.current_version = [string]$installed.version
        $report.target_version = $version
        $report.channel = $channel
        if ([version]$installed.version -ge [version]$version) {
          $report.state = 'current'
          Write-Host '[SKIPPED] Requested version already installed or superseded.'
        } else {
          $rootBin = Split-Path -Path $dsh.Source -Parent
          $appRoot = [IO.Path]::GetFullPath((Join-Path $rootBin '..\..\..\..'))
          $names = @(Get-ChildItem -LiteralPath $appRoot -File -Filter '*.exe' |
            Where-Object { $_.Name -match '(?i)DeepSeek|Harness|DSH' } |
            ForEach-Object { $_.Name })
          if ($names.Count -eq 0) { throw 'Desktop executable could not be identified.' }
          $active = @(Get-CimInstance Win32_Process |
            Where-Object { $names -contains $_.Name })
          if ($active.Count -gt 0) {
            $report.state = 'deferred'
            Write-Host '[DEFERRED] DSH is open; no install while Agent sessions may be running.'
          } else {
            $report.state = 'ready'
            $report.needed = $true
            Write-Host ('[PASSED] Explicit ' + $channel + ' update ' + $version + ' is eligible.')
          }
        }
      }
    }
  }
} catch {
  $report.state = 'failed'
  $exitCode = 1
  Write-Host ('[FAILED] Channel update request validation at ' + $step + '; no installer was called.')
} finally {
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $resultDir 'probe.json') -Encoding UTF8
  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_OUTPUT)) {
    ('needed=' + ([string]$report.needed).ToLowerInvariant()) |
      Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding ASCII
    ('channel=' + [string]$report.channel) |
      Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding ASCII
    ('version=' + [string]$report.target_version) |
      Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding ASCII
  }
}
exit $exitCode

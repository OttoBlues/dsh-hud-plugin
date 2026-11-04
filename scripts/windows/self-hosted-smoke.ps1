# Windows PowerShell 5.1 compatible. Manually dispatched only; do not run as Administrator.
[CmdletBinding()]
param(
  [ValidateSet('preflight', 'install-smoke')]
  [string] $Mode = 'preflight',
  [ValidateSet('released', 'unstable')]
  [string] $Channel = 'unstable',
  [ValidateRange(10, 180)]
  [int] $StartupTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$resultsDirectory = Join-Path $root 'smoke-results'
New-Item -ItemType Directory -Force -Path $resultsDirectory | Out-Null
$checks = New-Object 'System.Collections.Generic.List[object]'
$report = [ordered]@{
  schema = 1
  mode = $Mode
  channel = $Channel
  created_utc = (Get-Date).ToUniversalTime().ToString('o')
  run_id = $env:GITHUB_RUN_ID
  overall = 'pending'
  dsh_version = $null
  checks = $checks
}

function Record-Check([string] $Name, [string] $Status, [string] $Note) {
  $checks.Add([pscustomobject]@{ name = $Name; status = $Status; note = $Note })
  Write-Host ('[{0}] {1}: {2}' -f $Status.ToUpperInvariant(), $Name, $Note)
}

function Invoke-DshToFile([string[]] $Arguments, [string] $LogPath) {
  # Never print raw CLI output. DSH diagnostics may contain sensitive configuration.
  & $script:dshExecutable @Arguments *> $LogPath
  return $LASTEXITCODE
}

function Free-LoopbackPort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    return ([System.Net.IPEndPoint] $listener.LocalEndpoint).Port
  } finally {
    $listener.Stop()
  }
}

function Test-HttpResponse([string] $Url) {
  try {
    $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0
    return $true
  } catch [System.Net.WebException] {
    # Unauthenticated Web UI may legitimately respond with a redirect or 401/403.
    return ($null -ne $_.Exception.Response)
  } catch {
    return $false
  }
}

$temporaryHome = $null
$activeStage = 'runner'
$previousHome = [Environment]::GetEnvironmentVariable('DSH_HOME', 'Process')
$serverProcess = $null
$exitCode = 0
try {
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'This smoke test must run on Windows.'
  }
  Record-Check 'runner' 'passed' 'Windows host reachable by GitHub Actions.'

  $activeStage = 'node'
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -ne $node) {
    $nodeVersion = (& $node.Source --version 2>$null).Trim()
    Record-Check 'node' 'passed' ('Node.js present (' + $nodeVersion + ').')
  } else {
    Record-Check 'node' 'warning' 'Node.js is not on the initial PATH (install mode uses setup-node).'
  }

  $activeStage = 'dsh-cli'
  $dshReady = $false
  $dsh = Get-Command dsh -ErrorAction SilentlyContinue
  if ($null -ne $dsh) {
    $script:dshExecutable = $dsh.Source
    $rawVersion = & $script:dshExecutable --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $null -ne $rawVersion) {
      $report.dsh_version = (($rawVersion | Out-String).Trim() -split '\r?\n')[0]
      $dshReady = $true
      Record-Check 'dsh-cli' 'passed' 'DSH CLI found and --version succeeded.'
    } else {
      Record-Check 'dsh-cli' 'warning' 'DSH executable found, but --version failed. Repair the CLI in the Runner account.'
    }
  } else {
    Record-Check 'dsh-cli' 'warning' 'DSH CLI not found. Install or register dsh for the Runner account.'
  }

  if ($Mode -eq 'preflight') {
    if ($dshReady) {
      $report.overall = 'ready'
      Record-Check 'readiness' 'passed' 'DSH CLI is available for install-smoke.'
    } else {
      $report.overall = 'needs-setup'
      $exitCode = 1
      Record-Check 'readiness' 'failed' 'Run DSH Desktop Manage dsh Command, then restart the Runner before trying install-smoke.'
    }
  } else {
    if (-not $dshReady) { throw 'DSH CLI is required for install-smoke.' }

    $activeStage = 'reviewed-channel-bundle'
    $channelIndexPath = Join-Path $root ('plugins\hud\' + $Channel + '\index.json')
    $index = Get-Content -LiteralPath $channelIndexPath -Raw | ConvertFrom-Json
    if ($index.schema -ne 1 -or $index.component -ne 'hud' -or
        $index.channel -ne $Channel -or $index.package -ne '@local/dsh-hud') {
      throw 'Invalid trusted channel index.'
    }
    $version = [string]$index.latest
    if ($version -notmatch '^\d+\.\d+\.\d+$') {
      throw 'No vetted installer is published in the selected channel.'
    }
    $selected = @($index.releases | Where-Object { $_.version -eq $version })
    if ($selected.Count -ne 1) { throw 'Vetted installer is not uniquely listed.' }
    $entry = $selected[0]
    $expectedFile = 'v' + $version + '/local-dsh-hud-' + $version + '.tgz'
    if ($entry.file -ne $expectedFile -or
        [string]$entry.sha256 -notmatch '^[0-9a-f]{64}$') {
      throw 'Vetted installer descriptor invalid.'
    }
    $fullBundle = [IO.Path]::GetFullPath((Join-Path $root ('plugins\hud\' + $Channel + '\' + $entry.file.Replace('/', '\'))))
    if (-not (Test-Path -LiteralPath $fullBundle -PathType Leaf)) {
      throw 'A reviewed .tgz is missing from the channel.'
    }
    $actualHash = (Get-FileHash -LiteralPath $fullBundle -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne [string]$entry.sha256) { throw 'Vetted installer SHA-256 mismatch.' }
    Record-Check 'reviewed-channel-bundle' 'passed' ('Verified ' + $Channel + ' HUD v' + $version + ' without using HEAD source.')

    $runnerTemp = $env:RUNNER_TEMP
    if ([string]::IsNullOrWhiteSpace($runnerTemp)) {
      $runnerTemp = [IO.Path]::GetTempPath()
    }
    $temporaryHome = Join-Path $runnerTemp ('dsh-hud-smoke-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporaryHome -Force | Out-Null
    $env:DSH_HOME = $temporaryHome
    $profileName = 'hud-ci'

    $activeStage = 'web-profile'
    $code = Invoke-DshToFile @('--profile', $profileName, '--from-default-profile', 'web', '--dump-config') (Join-Path $temporaryHome 'initialize.log')
    if ($code -ne 0) { throw ('DSH Web profile initialization failed (exit ' + $code + ').') }
    Record-Check 'web-profile' 'passed' 'Fresh isolated DSH Web profile initialized.'

    $activeStage = 'plugin-install'
    $code = Invoke-DshToFile @('plugin', '--profile', $profileName, 'add', $fullBundle) (Join-Path $temporaryHome 'install.log')
    if ($code -ne 0) { throw ('DSH plugin install failed (exit ' + $code + ').') }
    Record-Check 'plugin-install' 'passed' 'HUD Bundle installed into isolated profile.'

    $activeStage = 'configuration'
    $configLog = Join-Path $temporaryHome 'config.log'
    $code = Invoke-DshToFile @('--profile', $profileName, '--dump-config') $configLog
    if ($code -ne 0) { throw ('DSH composed config failed (exit ' + $code + ').') }
    $configDump = Get-Content -LiteralPath $configLog -Raw
    if ($configDump -notmatch '@local/dsh-hud') {
      throw 'DSH composed configuration did not include @local/dsh-hud.'
    }
    Record-Check 'configuration' 'passed' 'HUD Cordis row present in composed profile.'

    $activeStage = 'web-startup'
    $port = Free-LoopbackPort
    $bootScript = Join-Path $temporaryHome 'boot.ps1'
    $quotedExe = $script:dshExecutable.Replace("'", "''")
    @(
      "& '$quotedExe' --profile $profileName --no-open --host 127.0.0.1 --port $port",
      'exit $LASTEXITCODE'
    ) | Set-Content -LiteralPath $bootScript -Encoding UTF8
    $stdout = Join-Path $temporaryHome 'web-stdout.log'
    $stderr = Join-Path $temporaryHome 'web-stderr.log'
    $serverProcess = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $bootScript + '"') -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr

    $ready = $false
    $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
      if ($serverProcess.HasExited) { break }
      if (Test-HttpResponse ('http://127.0.0.1:' + $port + '/')) {
        $ready = $true
        break
      }
      Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'DSH Web process did not answer HTTP within startup timeout.' }
    Record-Check 'web-startup' 'passed' 'Isolated DSH Web server responded over loopback HTTP.'
    $report.overall = 'passed'
  }
} catch {
  $exitCode = 1
  $report.overall = 'failed'
  # Report only the failing stage, not raw exception text, to avoid leaking secrets.
  Record-Check $activeStage 'failed' 'This stage failed. Raw CLI output is not uploaded to GitHub.'
} finally {
  if ($null -ne $serverProcess) {
    try {
      if (-not $serverProcess.HasExited) {
        & "$env:SystemRoot\System32\taskkill.exe" /PID $serverProcess.Id /T /F *> $null
      }
    } catch {}
    try { $serverProcess.Dispose() } catch {}
  }
  [Environment]::SetEnvironmentVariable('DSH_HOME', $previousHome, 'Process')
  if ($null -ne $temporaryHome -and (Test-Path -LiteralPath $temporaryHome)) {
    try {
      Remove-Item -LiteralPath $temporaryHome -Recurse -Force -ErrorAction Stop
      Record-Check 'cleanup' 'passed' 'Temporary DSH home deleted.'
    } catch {
      $exitCode = 1
      $report.overall = 'failed'
      Record-Check 'cleanup' 'failed' 'Temporary test files remain on runner; remove them manually.'
    }
  }
  $resultFile = Join-Path $resultsDirectory 'dsh-hud-smoke.json'
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultFile -Encoding UTF8

  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_STEP_SUMMARY)) {
    $lines = @('## DSH HUD Windows smoke', '', ('Mode: **' + $Mode + '**; result: **' + $report.overall + '**'), '', '| Check | Status | Note |', '| --- | --- | --- |')
    foreach ($check in $checks) {
      $lines += ('| ' + $check.name + ' | ' + $check.status + ' | ' + $check.note.Replace('|', '/') + ' |')
    }
    $lines | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding UTF8
  }
}
exit $exitCode

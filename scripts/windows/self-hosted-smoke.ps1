# Windows PowerShell 5.1 compatible. Manually dispatched only; do not run as Administrator.
[CmdletBinding()]
param(
  [ValidateSet('preflight', 'install-smoke')]
  [string] $Mode = 'preflight',
  [string] $BundlePath = 'dist\local-dsh-hud-0.1.0.tgz',
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
  $dsh = Get-Command dsh -ErrorAction SilentlyContinue
  if ($null -ne $dsh) {
    $script:dshExecutable = $dsh.Source
    $rawVersion = & $script:dshExecutable --version 2>$null
    if ($LASTEXITCODE -eq 0 -and $null -ne $rawVersion) {
      $report.dsh_version = (($rawVersion | Out-String).Trim() -split '\r?\n')[0]
    }
    Record-Check 'dsh-cli' 'passed' 'DSH CLI found on runner PATH.'
  } else {
    Record-Check 'dsh-cli' 'warning' 'DSH CLI not found: install DSH and expose dsh to the runner account.'
  }

  if ($Mode -eq 'preflight') {
    $report.overall = if ($null -ne $dsh) { 'ready' } else { 'needs-setup' }
  } else {
    if ($null -eq $dsh) { throw 'DSH CLI is required for install-smoke.' }

    $activeStage = 'bundle'
    $fullBundle = [IO.Path]::GetFullPath((Join-Path $root $BundlePath))
    if (-not (Test-Path -LiteralPath $fullBundle -PathType Leaf)) {
      throw 'HUD Bundle tarball missing. Run npm run pack:hud first.'
    }
    Record-Check 'bundle' 'passed' 'HUD .tgz exists; source test/build ran in workflow.'

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

<#
DSH HUD v0.5.7 Windows native window.
This file is bundled with @local/dsh-hud. It executes no remote code.
Its only window controls are "Return to DSH", Escape and Alt+F4.
#>
param(
  [int]$ShellPid = 0,
  [int]$HostPid = 0,
  [ValidateSet('zh','en')][string]$Language = 'zh',
  [switch]$SelfTest,
  [switch]$RestoreOnly
)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DshHudWin32 {
  public delegate bool EnumWindowProc(IntPtr hwnd, IntPtr lparam);
  [StructLayout(LayoutKind.Sequential)]
  public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowProc callback, IntPtr data);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out int pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder text, int length);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int length);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);

  // Only the single identifiable DSH app window, never any arbitrary user window.
  public static IntPtr FindShell(int shellPid, bool includeHidden) {
    IntPtr match = IntPtr.Zero;
    int matches = 0;
    EnumWindows((hwnd, unused) => {
      int pid;
      GetWindowThreadProcessId(hwnd, out pid);
      if (pid != shellPid || (!includeHidden && !IsWindowVisible(hwnd))) return true;
      StringBuilder cls = new StringBuilder(256);
      GetClassName(hwnd, cls, cls.Capacity);
      if (!cls.ToString().StartsWith("Chrome_WidgetWin_", StringComparison.Ordinal)) return true;
      StringBuilder title = new StringBuilder(512);
      GetWindowText(hwnd, title, title.Capacity);
      string name = title.ToString();
      if (name.IndexOf("DeepSeek Harness", StringComparison.OrdinalIgnoreCase) < 0 &&
          !name.Equals("DSH", StringComparison.OrdinalIgnoreCase) &&
          !name.StartsWith("DSH ", StringComparison.OrdinalIgnoreCase)) return true;
      Rect area;
      if (!GetWindowRect(hwnd, out area) || (area.Right-area.Left) < 500 ||
          (area.Bottom-area.Top) < 300) return true;
      match = hwnd;
      matches++;
      return true;
    }, IntPtr.Zero);
    return matches == 1 ? match : IntPtr.Zero;
  }
}
'@

if ($RestoreOnly) {
  if ($ShellPid -gt 0) {
    $target = [DshHudWin32]::FindShell($ShellPid, $true)
    if ($target -ne [IntPtr]::Zero) {
      [void][DshHudWin32]::ShowWindow($target, 9)
      [void][DshHudWin32]::SetForegroundWindow($target)
    }
  }
  [Console]::Out.WriteLine('RESTORED')
  exit 0
}

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
[xml]$markup = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="DSH HUD" Width="1120" Height="730"
        WindowStyle="None" ResizeMode="NoResize"
        WindowStartupLocation="CenterScreen"
        Background="#071522" Foreground="#E6F1F4"
        FontFamily="Segoe UI" ShowInTaskbar="True" Topmost="False">
  <Grid Margin="27">
    <Grid.ColumnDefinitions>
      <ColumnDefinition Width="194"/>
      <ColumnDefinition Width="*"/>
    </Grid.ColumnDefinitions>
    <Border Grid.Column="0" BorderBrush="#6DCBD2" BorderThickness="0,0,1,0" Padding="10,20,20,10">
      <StackPanel>
        <TextBlock Text="HUD" Foreground="#6DCBD2" FontSize="34" FontWeight="Bold" CharacterSpacing="250"/>
        <Border Background="#6DCBD2" Height="1" Margin="0,16,0,12"/>
        <TextBlock Text="VECTOR / INTERFACE" Foreground="#A8BDC6" FontFamily="Consolas" FontSize="11"/>
        <Border Background="#142B3A" BorderBrush="#6DCBD2" BorderThickness="1" Padding="14" Margin="0,40,0,0">
          <TextBlock x:Name="NavigationLabel" Text="总览 / 会话" Foreground="#6DCBD2" FontSize="15"/>
        </Border>
        <TextBlock x:Name="SnapshotWarning" Text="会话状态为打开窗口时的快照。操作、聊天和审批仍在 DSH 中进行。"
                   Foreground="#A8BDC6" TextWrapping="Wrap" FontSize="12"
                   Margin="0,28,0,0" LineHeight="21"/>
      </StackPanel>
    </Border>
    <Grid Grid.Column="1" Margin="27,0,0,0">
      <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="Auto"/>
      </Grid.RowDefinitions>
      <DockPanel Grid.Row="0" Margin="0,8,0,23" LastChildFill="True">
        <Button x:Name="ReturnButton" Content="返回 DSH" DockPanel.Dock="Right"
                Foreground="#071522" Background="#6DCBD2" BorderBrush="#6DCBD2"
                BorderThickness="1" FontSize="14" FontWeight="SemiBold"
                Width="140" Height="42" Cursor="Hand" Margin="20,0,0,0"/>
        <StackPanel>
          <TextBlock Text="DSH // HUD 0.5.7" Foreground="#6DCBD2" FontSize="12" FontFamily="Consolas"/>
          <TextBlock x:Name="WindowHeading" Text="HUD 独立工作台" FontSize="30" FontWeight="SemiBold" Margin="0,7,0,0"/>
        </StackPanel>
      </DockPanel>
      <ScrollViewer Grid.Row="1" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled">
        <StackPanel>
          <Border BorderBrush="#6DCBD2" BorderThickness="1" Background="#142B3A" Padding="27" Margin="0,0,0,17">
            <StackPanel>
              <TextBlock x:Name="LiveLabel" Text="DSH / 会话快照" Foreground="#6DCBD2" FontSize="12"/>
              <TextBlock x:Name="MissionTitle" Text="任务态势中心" FontSize="30" Margin="0,18,0,9"/>
              <TextBlock x:Name="SnapshotTime" Text="等待 DSH 会话状态" Foreground="#A8BDC6" FontSize="13"/>
            </StackPanel>
          </Border>
          <Grid Margin="0,0,0,17">
            <Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="16"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
            <Border Grid.Column="0" BorderBrush="#6DCBD2" BorderThickness="1" Background="#142B3A" Padding="20">
              <StackPanel>
                <TextBlock x:Name="SessionsLabel" Text="会话数量" Foreground="#6DCBD2" FontSize="12"/>
                <TextBlock x:Name="SessionsNumber" Text="0" FontSize="36" Margin="0,12,0,0"/>
              </StackPanel>
            </Border>
            <Border Grid.Column="2" BorderBrush="#6DCBD2" BorderThickness="1" Background="#142B3A" Padding="20">
              <StackPanel>
                <TextBlock x:Name="RunningLabel" Text="运行中" Foreground="#6DCBD2" FontSize="12"/>
                <TextBlock x:Name="RunningNumber" Text="0" FontSize="36" Margin="0,12,0,0"/>
              </StackPanel>
            </Border>
          </Grid>
          <Border BorderBrush="#6DCBD2" BorderThickness="1" Background="#142B3A" Padding="22">
            <StackPanel>
              <TextBlock x:Name="SessionsHeading" Text="最近会话" Foreground="#6DCBD2" FontSize="15" FontWeight="SemiBold"/>
              <TextBlock x:Name="SessionRows" Text="暂无会话" TextWrapping="Wrap" FontSize="14"
                         LineHeight="27" Margin="0,14,0,0" Foreground="#E6F1F4"/>
            </StackPanel>
          </Border>
        </StackPanel>
      </ScrollViewer>
      <Border Grid.Row="2" BorderBrush="#6DCBD2" BorderThickness="1,0,0,0" Margin="0,23,0,0" Padding="0,17,0,0">
        <TextBlock x:Name="FooterText" Text="独立原生 HUD · 仅供查看，返回 DSH 继续操作"
                   Foreground="#A8BDC6" FontSize="12"/>
      </Border>
    </Grid>
  </Grid>
</Window>
'@
$reader = New-Object System.Xml.XmlNodeReader $markup
$window = [Windows.Markup.XamlReader]::Load($reader)

if ($window.WindowStyle -ne [Windows.WindowStyle]::None -or
    $window.ResizeMode -ne [Windows.ResizeMode]::NoResize -or
    $null -eq $window.FindName('ReturnButton')) {
  throw 'HUD borderless window contract failed.'
}
if ($SelfTest) {
  [Console]::Out.WriteLine('HUD_SELF_TEST_OK')
  exit 0
}
if ($ShellPid -lt 1 -or $HostPid -lt 1) { throw 'Invalid DSH Desktop / Host PID.' }
if ($null -eq (Get-Process -Id $ShellPid -ErrorAction SilentlyContinue)) {
  throw 'DSH Desktop shell process is unavailable.'
}
$target = [DshHudWin32]::FindShell($ShellPid, $false)
if ($target -eq [IntPtr]::Zero) { throw 'Expected exactly one visible DSH Desktop app window.' }

# Native window receives ONLY an initial read-only snapshot on its private stdin.
# This avoids leaking session titles through command lines, URLs or temporary files.
$base64 = [Console]::In.ReadLine()
$rows = @()
$capturedAt = ''
try {
  if ($base64 -and $base64.Length -le 32000) {
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64))
    $snapshot = ConvertFrom-Json -InputObject $json
    $rows = @($snapshot.sessions | Where-Object { $null -ne $_ }) | Select-Object -First 16
    $capturedAt = [string]$snapshot.capturedAt
  }
} catch { $rows = @(); $capturedAt = '' }

if ($Language -eq 'en') {
  $window.FindName('ReturnButton').Content = 'Return to DSH'
  $window.FindName('WindowHeading').Text = 'Independent HUD'
  $window.FindName('NavigationLabel').Text = 'Overview / Sessions'
  $window.FindName('SnapshotWarning').Text = 'Session data is a snapshot from launch. Chat, approvals and actions remain in DSH.'
  $window.FindName('LiveLabel').Text = 'DSH / SESSION SNAPSHOT'
  $window.FindName('MissionTitle').Text = 'MISSION CONTROL'
  $window.FindName('SessionsLabel').Text = 'SESSIONS'
  $window.FindName('RunningLabel').Text = 'RUNNING'
  $window.FindName('SessionsHeading').Text = 'RECENT SESSIONS'
  $window.FindName('FooterText').Text = 'Independent native HUD / Return to DSH to continue'
}
$window.Width = [Math]::Min($window.Width, [System.Windows.SystemParameters]::WorkArea.Width * 0.94)
$window.Height = [Math]::Min($window.Height, [System.Windows.SystemParameters]::WorkArea.Height * 0.94)
$window.FindName('SessionsNumber').Text = [string]$rows.Count
$running = @($rows | Where-Object { $_.running -eq $true }).Count
$window.FindName('RunningNumber').Text = [string]$running
$window.FindName('SnapshotTime').Text = if ($capturedAt) {
  if ($Language -eq 'en') { 'Captured at ' + $capturedAt } else { '读取时间：' + $capturedAt }
} else {
  if ($Language -eq 'en') { 'No session snapshot available' } else { '尚未收到会话快照' }
}
if ($rows.Count -gt 0) {
  $lines = foreach ($row in $rows) {
    $title = [string]$row.title
    if ($title.Length -gt 100) { $title = $title.Substring(0,100) }
    if ($Language -eq 'en') { if ($row.running) { '[RUNNING] ' + $title } else { '[IDLE] ' + $title } }
    else { if ($row.running) { '● 运行中  ' + $title } else { '○ 空闲    ' + $title } }
  }
  $window.FindName('SessionRows').Text = $lines -join [Environment]::NewLine
} elseif ($Language -eq 'en') { $window.FindName('SessionRows').Text = 'No sessions at launch' }

$script:hiddenShell = $false
$window.FindName('ReturnButton').Add_Click({ $window.Close() })
$window.Add_PreviewKeyDown({
  if ($_.Key -eq [Windows.Input.Key]::Escape) { $window.Close() }
})
$exitTask = [Console]::In.ReadLineAsync()
$watch = New-Object Windows.Threading.DispatcherTimer
$watch.Interval = [TimeSpan]::FromMilliseconds(750)
$watch.Add_Tick({
  if ($null -eq (Get-Process -Id $HostPid -ErrorAction SilentlyContinue)) {
    $window.Close()
  } elseif ($exitTask.IsCompleted) {
    try {
      $command = $exitTask.Result
      if ($null -eq $command -or $command -eq 'EXIT') { $window.Close() }
    } catch { $window.Close() }
  }
})
$window.Add_ContentRendered({
  try {
    if (-not [DshHudWin32]::ShowWindow($target, 0)) {
      [Console]::Out.WriteLine('ERROR: DSH Desktop window could not be hidden.')
      $window.Close()
      return
    }
    $script:hiddenShell = $true
    $window.Activate() | Out-Null
    [Console]::Out.WriteLine('READY')
    $watch.Start()
  } catch {
    [Console]::Out.WriteLine('ERROR: failed to activate independent HUD.')
    $window.Close()
  }
})
try {
  [void]$window.ShowDialog()
} finally {
  $watch.Stop()
  if ($script:hiddenShell) {
    [void][DshHudWin32]::ShowWindow($target, 9)
    [void][DshHudWin32]::SetForegroundWindow($target)
  }
}

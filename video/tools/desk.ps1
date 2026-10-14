# Minimal desktop driver for recording the demo in the owner's own Chrome session.
# Usage: powershell -File desk.ps1 <command> [args]
#   focus <processName>          bring that process's main window to the front and maximize it
#   click <x> <y>                left click at physical pixel coordinates (1920x1080 space)
#   move <x> <y>                 move the cursor
#   scroll <x> <y> <notches>     scroll (negative = down)
#   type <text>                  type text via the clipboard (paste)
#   keys <sendkeys>              send keys, e.g. "^l" (Ctrl+L), "{ENTER}"
#   minimize <processName>       minimize that process's windows (keeps VS Code out of the recording)
#   pin [off]                    keep Chrome on top while recording / release it
#   windows                      list visible top-level window titles
param([string]$cmd, [string]$a, [string]$b, [string]$c)

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, int d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@
[void][W]::SetProcessDPIAware()

# Every input action targets Chrome. VS Code can take focus between commands, so bring Chrome
# forward first and refuse to send keystrokes anywhere else.
function Get-ForegroundProcessName {
  $pid2 = 0
  [void][W]::GetWindowThreadProcessId([W]::GetForegroundWindow(), [ref]$pid2)
  (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).ProcessName
}
function Ensure-Chrome {
  if ((Get-ForegroundProcessName) -eq 'chrome') { return }
  $p = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  [W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  [void][W]::SetForegroundWindow($p.MainWindowHandle)
  Start-Sleep -Milliseconds 300
  if ((Get-ForegroundProcessName) -ne 'chrome') { Write-Output 'ABORT: Chrome is not in front'; exit 2 }
}
if ($cmd -in @('click', 'scroll', 'type', 'keys')) { Ensure-Chrome }

switch ($cmd) {
  'focus' {
    $p = Get-Process -Name $a -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if (-not $p) { Write-Output "no window for $a"; exit 1 }
    # Alt tap lets SetForegroundWindow succeed from a background process.
    [W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    [void][W]::ShowWindow($p.MainWindowHandle, 3)
    [void][W]::SetForegroundWindow($p.MainWindowHandle)
    Write-Output ("focused: " + $p.MainWindowTitle)
  }
  'pin' {
    # Keep Chrome above other windows while recording (VS Code otherwise steals the screen). 'pin off' restores.
    $p = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    $after = if ($a -eq 'off') { [IntPtr](-2) } else { [IntPtr](-1) }
    [void][W]::SetWindowPos($p.MainWindowHandle, $after, 0, 0, 0, 0, 0x0003)
    Write-Output ("pinned=" + ($a -ne 'off'))
  }
  'minimize' {
    Get-Process -Name $a -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { [void][W]::ShowWindow($_.MainWindowHandle, 6) }
    Write-Output "minimized $a"
  }
  'move' { [void][W]::SetCursorPos([int]$a, [int]$b) }
  'click' {
    [void][W]::SetCursorPos([int]$a, [int]$b); Start-Sleep -Milliseconds 120
    [W]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60
    [W]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  }
  'scroll' {
    [void][W]::SetCursorPos([int]$a, [int]$b)
    $n = [int]$c; $step = if ($n -lt 0) { -120 } else { 120 }
    for ($i = 0; $i -lt [Math]::Abs($n); $i++) { [W]::mouse_event(0x0800, 0, 0, $step, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 }
  }
  'type' {
    [System.Windows.Forms.Clipboard]::SetText($a)
    [System.Windows.Forms.SendKeys]::SendWait('^v')
  }
  'keys' { [System.Windows.Forms.SendKeys]::SendWait($a) }
  'windows' {
    $cb = [W+EnumProc]{ param($h, $l)
      if ([W]::IsWindowVisible($h)) { $sb = New-Object System.Text.StringBuilder 512; [void][W]::GetWindowText($h, $sb, 512); if ($sb.Length -gt 0) { Write-Output $sb.ToString() } }
      return $true }
    [void][W]::EnumWindows($cb, [IntPtr]::Zero)
  }
}

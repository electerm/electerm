param([long]$WindowHandle, [int]$X, [int]$Y)

Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class WindowHitTest {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr window, ref POINT point);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
}'

[void][WindowHitTest]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$window = [IntPtr]::new($WindowHandle)
$point = New-Object WindowHitTest+POINT
$point.X = $X
$point.Y = $Y
if (-not [WindowHitTest]::ClientToScreen($window, [ref]$point)) {
  throw 'Cannot convert the test window point to screen coordinates'
}
$coordinates = (($point.Y -band 65535) -shl 16) -bor ($point.X -band 65535)
[WindowHitTest]::SendMessage($window, 132, [IntPtr]::Zero, [IntPtr]::new($coordinates)).ToInt64()

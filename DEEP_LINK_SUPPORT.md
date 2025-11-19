# Deep Link Support for Electerm

Electerm now supports deep links (protocol URLs) to open connections directly from browsers, other applications, or scripts. This feature allows you to create clickable links that automatically open connections in Electerm.

## Supported Protocols

- `ssh://` - SSH connections
- `telnet://` - Telnet connections
- `rdp://` - Remote Desktop Protocol connections
- `vnc://` - VNC connections
- `serial://` - Serial port connections

## URL Format

### SSH, Telnet, RDP, and VNC

```
protocol://[username[:password]@]host[:port][?title=name&key=value]
```

**Examples:**

```bash
# Basic telnet connection
telnet://192.168.2.31:34554

# SSH with username
ssh://user@example.com

# SSH with username and port
ssh://admin@192.168.1.100:2222

# SSH with username, password, and custom title
ssh://user:pass@example.com:22?title=Production%20Server

# RDP connection
rdp://administrator@windows-server.local:3389

# VNC connection
vnc://192.168.1.50:5900
```

### Serial Port

```
serial://PORT?baudRate=RATE&dataBits=BITS&stopBits=BITS&parity=PARITY
```

**Examples:**

```bash
# Basic serial connection (default: 115200 baud, 8N1)
serial://COM1

# Custom serial settings
serial://COM3?baudRate=9600&dataBits=8&stopBits=1&parity=none

# Linux/macOS serial port
serial:///dev/ttyUSB0?baudRate=115200
```

## Query Parameters

You can add additional parameters to customize connections:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `title` | Custom tab title | `?title=My%20Server` |
| `name` | Alias for title | `?name=Database` |
| `privateKey` | Path to SSH private key | `?privateKey=/path/to/key` |
| `key` | Alias for privateKey | `?key=~/.ssh/id_rsa` |

## Usage Examples

### From HTML

```html
<!-- Click to open telnet connection -->
<a href="telnet://192.168.2.31:34554">Connect to Device</a>

<!-- SSH to production server -->
<a href="ssh://deploy@prod-server.com?title=Production">Production Server</a>

<!-- RDP to Windows machine -->
<a href="rdp://admin@192.168.1.10:3389">Windows Desktop</a>
```

### From Command Line

```bash
# macOS/Linux
open "telnet://192.168.2.31:34554"
xdg-open "ssh://user@server.com"

# Windows
start "telnet://192.168.2.31:34554"

# Or directly with electerm
electerm "ssh://user@example.com:22"
```

### From JavaScript

```javascript
// Open link programmatically
window.location.href = 'ssh://user@server.com?title=My%20Server'

// Or open in new context
window.open('telnet://192.168.1.100:23', '_blank')
```

### Creating Desktop Shortcuts

#### macOS
Create a file `server.command`:
```bash
#!/bin/bash
open "ssh://user@server.com?title=My%20Server"
```
Make it executable: `chmod +x server.command`

#### Windows
Create a file `server.bat`:
```batch
@echo off
start "" "ssh://user@server.com?title=My Server"
```

#### Linux
Create a file `server.desktop`:
```ini
[Desktop Entry]
Type=Application
Name=My Server
Exec=xdg-open "ssh://user@server.com?title=My Server"
Terminal=false
```

## URL Encoding

Remember to URL-encode special characters in parameters:
- Space → `%20`
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`

**Example:**
```
ssh://user@host.com?title=Production%20Server%20%231
```

## Platform-Specific Notes

### macOS
- Deep links work automatically after building the app
- Protocol handlers are registered via `CFBundleURLTypes` in Info.plist (handled by electron-builder)
- Registration makes Electerm **available** as a handler but doesn't force it as the default
- Users can choose their preferred app in System Preferences

### Windows
- Protocol handlers are registered during installation via NSIS installer
- First-time users may see a security prompt asking for permission
- If another app (like PuTTY) is already the default for `ssh://`, Windows will let users choose
- Users can change the default app in Settings → Apps → Default apps

### Linux
- Protocol handlers are registered via `.desktop` file
- May need manual setup depending on the desktop environment
- Doesn't override existing handlers; users can select from available handlers

### Important Note
**Protocol registration is NON-INTRUSIVE**: Electerm registers itself as an available handler but doesn't forcefully take over from existing applications. Users always have control over which app handles these protocols through their system settings.

## Working Without Protocol Registration

You can use deep links even without registering Electerm as the default handler:

### Using Command Line
```bash
# macOS - explicitly specify electerm
open -a electerm "telnet://192.168.2.31:34554"

# Linux - with full path
/usr/bin/electerm "ssh://user@host:22"

# Windows - with full path
"C:\Program Files\electerm\electerm.exe" "telnet://192.168.2.31:34554"
```

### Right-Click in Browser
1. Right-click on a protocol link
2. Select "Open with..."
3. Choose Electerm (even if not the default)

### Disabling Protocol Registration
If you prefer not to register Electerm for these protocols, you can:
- Comment out `registerDeepLink()` in `src/app/lib/create-app.js`
- Uninstall and reinstall without protocol handlers
- Use system settings to remove Electerm as a handler

The deep link **parsing and handling** will still work; only the automatic protocol association is disabled.

## Development and Testing

To test deep links in development mode, set the environment variable:

```bash
ELECTERM_REGISTER_PROTOCOLS=1 npm start
```

Then test with:
```bash
# macOS/Linux
open "telnet://localhost:23"

# Windows
start "telnet://localhost:23"
```

## Security Considerations

⚠️ **Warning:** Be careful when sharing URLs with passwords embedded:

```
# NOT RECOMMENDED - password visible in URL
ssh://user:mypassword@server.com

# RECOMMENDED - let user enter password
ssh://user@server.com
```

For better security:
1. Use SSH keys instead of passwords
2. Don't embed credentials in URLs that might be logged or shared
3. Use query parameters only for non-sensitive information like titles

## Troubleshooting

### Links not working
1. Make sure Electerm is installed (not just running from source)
2. On Windows, reinstall to re-register protocol handlers
3. On Linux, check that the `.desktop` file is properly installed
4. Check Electerm logs for parsing errors

### Opening in wrong application
1. Check default application settings in your OS
2. Right-click a link and select "Open with Electerm"
3. Set Electerm as default for these protocols in system settings

### URL parsing errors
- Check that the URL is properly formatted
- Use URL encoding for special characters
- Check Electerm logs for detailed error messages

## Implementation Details

Deep link support is implemented via:
- `src/app/lib/deep-link.js` - Core deep link handling
- `src/app/lib/create-app.js` - Protocol registration and event handlers
- `build/electron-builder.json` - Protocol declarations for electron-builder

The implementation handles:
- Protocol URL parsing and validation
- Cross-platform protocol registration
- Single instance behavior (focuses existing window)
- Graceful fallback if parsing fails

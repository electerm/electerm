# Deep Link Implementation Summary

## Overview
This implementation adds comprehensive deep link support to Electerm, allowing users to open connections directly from URLs like `telnet://192.168.2.31:34554`, `ssh://user@host:22`, etc.

## Changes Made

### 1. Core Deep Link Module
**File:** `src/app/lib/deep-link.js` (NEW)
- Parses protocol URLs (ssh://, telnet://, rdp://, vnc://, serial://)
- Registers Electerm as default protocol handler
- Handles deep link events across platforms (macOS open-url, Windows/Linux second-instance)
- Converts URLs to electerm command-line options format

### 2. App Integration
**File:** `src/app/lib/create-app.js`
- Added import of deep link functions
- Registers protocols on app startup
- Sets up deep link event handlers
- Enhanced second-instance handler to detect and parse protocol URLs

### 3. IPC Bridge
**File:** `src/app/lib/ipc.js`
- Uncommented deep link import
- Exposed `registerDeepLink` and `getPendingDeepLink` to renderer process
- Enables client-side deep link checking

### 4. Client-Side Initialization
**File:** `src/client/components/main/main.jsx`
- Uncommented `registerDeepLink` call
- Added `checkPendingDeepLink` call to handle startup URLs

**File:** `src/client/store/load-data.js`
- Added `checkPendingDeepLink` method to Store
- Integrates with existing `addTabFromCommandLine` flow

### 5. Build Configuration
**File:** `build/electron-builder.json`
- Added `protocols` array declaring ssh, telnet, rdp, vnc, and serial protocols
- Works across macOS, Windows, and Linux

### 6. Documentation
**File:** `DEEP_LINK_SUPPORT.md` (NEW)
- Comprehensive guide on using deep links
- URL format specifications
- Platform-specific notes
- Security considerations
- Troubleshooting guide

**Files:** `README.md`, `README_cn.md`
- Updated to mention deep link support
- Links to full documentation

### 7. Test Page
**File:** `test-deep-links.html` (NEW)
- HTML test page with clickable examples for all protocols
- Useful for testing and demonstration

## How It Works

### URL Parsing Flow
1. User clicks a protocol URL (e.g., `telnet://192.168.2.31:34554`)
2. OS recognizes Electerm as the handler
3. Deep link module parses the URL into electerm options
4. Options are sent to the renderer process
5. Existing `addTabFromCommandLine` opens the connection

### Platform-Specific Behavior

#### macOS
- Uses `open-url` event
- Protocol handlers registered via Info.plist (by electron-builder)
- Works automatically after building

#### Windows
- Uses `second-instance` event and command-line args
- Protocol handlers registered during installation
- Handles both startup URLs and second-instance clicks

#### Linux
- Uses `second-instance` event
- Protocol handlers registered via .desktop file
- May require desktop environment support

## Supported URL Formats

### Network Protocols
```
ssh://[username[:password]@]host[:port][?params]
telnet://[username[:password]@]host[:port][?params]
rdp://[username[:password]@]host[:port][?params]
vnc://[username[:password]@]host[:port][?params]
```

### Serial Ports
```
serial://PORT[?baudRate=RATE&dataBits=BITS&stopBits=BITS&parity=PARITY]
```

### Query Parameters
- `title` or `name`: Custom tab title
- `privateKey` or `key`: Path to SSH private key
- Serial: `baudRate`, `dataBits`, `stopBits`, `parity`

## Testing

### Development Mode
Set environment variable to enable protocol registration:
```bash
ELECTERM_REGISTER_PROTOCOLS=1 npm start
```

### Test with HTML File
Open `test-deep-links.html` in a browser and click the links.

### Command Line
```bash
# macOS/Linux
open "telnet://192.168.2.31:34554"

# Windows
start "telnet://192.168.2.31:34554"
```

## No External Dependencies
This implementation is **completely manual** and doesn't rely on any external npm packages for deep link handling. It uses:
- Native Electron APIs (`app.setAsDefaultProtocolClient`, events)
- Node.js built-in `URL` parser
- Custom URL parsing logic for special cases

## Benefits Over npm Libraries

1. **Cross-platform compatibility**: Works consistently on macOS, Windows, and Linux
2. **No dependencies**: No need to maintain external packages
3. **Full control**: Can customize behavior for electerm's specific needs
4. **Integration**: Seamlessly integrates with existing command-line handling
5. **Lightweight**: Minimal code footprint

## Future Enhancements

Possible improvements:
- Add more protocols (ftp://, sftp://)
- Support for bookmark IDs: `electerm://bookmark/ID`
- URL shortening integration
- QR code generation for mobile-to-desktop connections

## Backward Compatibility

This implementation:
- ✅ Doesn't break existing command-line functionality
- ✅ Works alongside existing `-opts` parameter
- ✅ Falls back gracefully if URL parsing fails
- ✅ Doesn't require changes to existing bookmarks or settings

# Deep Link Platform-Specific Setup Guide

This document explains the additional setup required for deep link protocol handling on macOS and Windows Store environments.

## Overview

According to [Electron's documentation](https://www.electronjs.org/docs/latest/api/app#appsetasdefaultprotocolclientprotocol-path-args), `app.setAsDefaultProtocolClient()` requires additional configuration on certain platforms:

- **macOS**: Protocols must be declared in `Info.plist`
- **Windows Store (appx)**: Protocols must be declared in the appx manifest

## Current Implementation Status

✅ **Already Configured**: The `protocols` section in `build/electron-builder.json` automatically handles the required configuration for both platforms during the build process.

## Platform-Specific Details

### macOS Configuration

**What happens automatically:**
- Electron Builder reads the `protocols` array from `electron-builder.json`
- During the build, it adds `CFBundleURLTypes` entries to the app's `Info.plist`
- The generated plist includes:
  ```xml
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>SSH Protocol</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>ssh</string>
      </array>
    </dict>
    <!-- Additional protocols... -->
  </array>
  ```

**Important Note:**
- `NSPrincipalClass` should be set to `AtomApplication` (Electron handles this automatically)
- These settings cannot be modified at runtime
- Changes require rebuilding the app

**To verify after build:**
```bash
# Extract and view Info.plist from built app
plutil -p /path/to/electerm.app/Contents/Info.plist | grep -A 20 CFBundleURLTypes
```

### Windows Store (appx) Configuration

**What happens automatically:**
- Electron Builder generates the appx manifest with protocol declarations
- The manifest includes `<uap:Protocol>` entries for each protocol:
  ```xml
  <Extensions>
    <uap:Extension Category="windows.protocol">
      <uap:Protocol Name="ssh">
        <uap:DisplayName>SSH Protocol</uap:DisplayName>
      </uap:Protocol>
    </uap:Extension>
    <!-- Additional protocols... -->
  </Extensions>
  ```

**Important Note:**
- According to Electron docs: "In a Windows Store environment (when packaged as an `appx`) this API will return `true` for all calls but the registry key it sets won't be accessible by other applications."
- To properly register, the protocol MUST be declared in the appx manifest (which Electron Builder does)
- Reference: [UWP Protocol Declaration](https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-protocol)

### Windows (Non-Store) and Linux

**What happens:**
- `app.setAsDefaultProtocolClient()` works directly without additional configuration
- Registration is done via:
  - Windows: Windows Registry
  - Linux: Desktop file and `LSSetDefaultHandlerForURLScheme`

## Testing Deep Links

### macOS
```bash
# After building the app
open "ssh://user@host:22"
open "telnet://192.168.1.1:23"
```

### Windows (Non-Store)
```powershell
# From PowerShell or Command Prompt
start ssh://user@host:22
```

### Windows Store (appx)
1. Install the appx package
2. On first protocol launch, Windows will show a dialog asking to choose a default handler
3. Select electerm and check "Always use this app"

### Linux
```bash
# After installing
xdg-open "ssh://user@host:22"
```

## Development vs Production

The current implementation includes a check to prevent protocol registration in development mode:

```javascript
const shouldRegister = app.isPackaged ||
                      force ||
                      process.env.ELECTERM_REGISTER_PROTOCOLS === '1'
```

**To test in development:**
```bash
ELECTERM_REGISTER_PROTOCOLS=1 npm start
```

## Troubleshooting

### macOS Issues

**Problem**: Protocol URLs not being handled
**Solutions**:
1. Verify the app is properly signed and notarized
2. Check if protocols are in Info.plist: `plutil -p YourApp.app/Contents/Info.plist`
3. Reset Launch Services database:
   ```bash
   /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user
   ```

**Problem**: macOS doesn't recognize the protocol
**Solution**: Make sure to listen for `open-url` event BEFORE the `ready` event:
```javascript
// This is already implemented in deep-link.js
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})
```

### Windows Store Issues

**Problem**: Other apps can't see electerm as a protocol handler
**Explanation**: This is expected behavior for appx apps as documented by Electron. The app will still handle protocols clicked within the Windows environment.

**Problem**: Protocol not working after appx installation
**Solutions**:
1. Verify protocol is declared in appx manifest
2. Check Windows Settings > Apps > Default apps > Choose default apps by protocol
3. Reinstall the app (sometimes required for protocol registration)

### General Issues

**Problem**: Deep link opens new instance instead of existing window
**Solution**: Ensure single instance lock is acquired:
```javascript
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}
```

## References

- [Electron app.setAsDefaultProtocolClient() Documentation](https://www.electronjs.org/docs/latest/api/app#appsetasdefaultprotocolclientprotocol-path-args)
- [Apple CFBundleURLTypes Documentation](https://developer.apple.com/library/ios/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html#//apple_ref/doc/uid/TP40009249-102207-TPXREF115)
- [Microsoft UWP Protocol Declaration](https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-protocol)
- [Electron Builder Protocol Configuration](https://www.electron.build/configuration/configuration#Configuration-protocols)

## Summary

✅ **Your current setup is correct!** The `protocols` configuration in `electron-builder.json` automatically handles all platform-specific requirements. No additional manual configuration is needed. Just ensure you build the app using Electron Builder for production, and the protocols will be properly registered on all platforms.

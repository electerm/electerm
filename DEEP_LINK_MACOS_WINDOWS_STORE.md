# macOS and Windows Store Deep Link Configuration - Quick Reference

## Summary

✅ **Your configuration is already correct!** No manual changes needed.

## What You Need to Know

### 1. macOS Configuration

**Requirement**: Protocol schemes must be declared in `Info.plist` with `CFBundleURLTypes`

**How it's handled**: 
- Automatically done by Electron Builder using the `protocols` section in `build/electron-builder.json`
- Cannot be modified at runtime
- Requires app rebuild for changes

**Your current config** (in `build/electron-builder.json`):
```json
"protocols": [
  {
    "name": "SSH Protocol",
    "schemes": ["ssh"]
  },
  {
    "name": "Telnet Protocol",
    "schemes": ["telnet"]
  },
  {
    "name": "RDP Protocol",
    "schemes": ["rdp"]
  },
  {
    "name": "VNC Protocol",
    "schemes": ["vnc"]
  },
  {
    "name": "Serial Protocol",
    "schemes": ["serial"]
  }
]
```

This automatically generates the required `CFBundleURLTypes` entries in the built app's `Info.plist`.

### 2. Windows Store (appx) Configuration

**Requirement**: Protocols must be declared in the appx manifest using `<uap:Protocol>`

**How it's handled**:
- Automatically done by Electron Builder using the same `protocols` section
- Generates proper manifest entries during appx packaging

**Important Note**: 
According to Electron docs, `app.setAsDefaultProtocolClient()` returns `true` in Windows Store apps, but the registry key won't be accessible to other apps. The protocol MUST be declared in the manifest for it to work properly.

### 3. Code Implementation

**Critical**: The `open-url` event listener must be registered BEFORE `app.whenReady()`:

```javascript
// In create-app.js - this is already correct ✅
setupDeepLinkHandlers()  // Registers 'open-url' listener
// ... then later ...
app.whenReady().then(() => createWindow(conf))
```

This is because on macOS, the `open-url` event can fire before the app is ready if launched by clicking a protocol URL.

## Testing

### Development Mode
```bash
# Enable protocol registration in development
ELECTERM_REGISTER_PROTOCOLS=1 npm start

# Then test with
open "ssh://user@host:22"  # macOS
```

### Production Build

**macOS**:
```bash
# Build the dmg
npm run build:mac

# Install and test
open "ssh://user@192.168.1.1:22"
```

**Windows Store**:
1. Build and install the appx
2. Click a protocol URL (e.g., from a web page or email)
3. Windows will prompt to choose an app (first time only)

## Verification After Build

### Verify macOS Info.plist
```bash
# Check if protocols are registered in the built app
plutil -p /path/to/electerm.app/Contents/Info.plist | grep -A 20 CFBundleURLTypes
```

You should see output like:
```
"CFBundleURLTypes" => [
  {
    "CFBundleURLName" => "SSH Protocol"
    "CFBundleURLSchemes" => [
      "ssh"
    ]
  }
  ...
]
```

### Verify Windows Store Manifest
The appx manifest will contain:
```xml
<Extensions>
  <uap:Extension Category="windows.protocol">
    <uap:Protocol Name="ssh">
      <uap:DisplayName>SSH Protocol</uap:DisplayName>
    </uap:Protocol>
  </uap:Extension>
  <!-- ... more protocols ... -->
</Extensions>
```

## Common Issues & Solutions

### macOS: Protocol not working
1. Ensure app is properly signed and notarized
2. Reset Launch Services database:
   ```bash
   /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user
   ```

### Windows Store: Protocol not recognized
1. Verify protocol is in appx manifest
2. Reinstall the app (sometimes needed for protocol registration)
3. Check Windows Settings > Apps > Default apps > Choose default apps by protocol

### General: Opens new instance instead of focusing existing
- Ensure single instance lock is requested (already implemented ✅)

## References

- [Electron Documentation](https://www.electronjs.org/docs/latest/api/app#appsetasdefaultprotocolclientprotocol-path-args)
- [Apple CFBundleURLTypes](https://developer.apple.com/library/ios/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html#//apple_ref/doc/uid/TP40009249-102207-TPXREF115)
- [Microsoft UWP Protocol](https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-uap-protocol)
- See `DEEP_LINK_PLATFORM_SETUP.md` for detailed information

## TL;DR

✅ Everything is already configured correctly via `build/electron-builder.json`
✅ The `open-url` event is registered before `app.whenReady()` (required for macOS)
✅ Just build and distribute the app normally - protocols will work on all platforms

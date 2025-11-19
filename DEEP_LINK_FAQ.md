# Deep Link Support - FAQ

## Does `registerDeepLink()` force Electerm to become the default app?

**No.** The `registerDeepLink()` function only registers Electerm as an **available handler** for protocols like `ssh://`, `telnet://`, etc. It does NOT forcefully override existing default applications.

### How it works on each platform:

#### macOS
- Registers Electerm as an option in the system
- Users can choose their preferred handler in System Preferences
- If another app is already the default, users will be prompted to choose

#### Windows
- Adds Electerm to the Windows Registry as a protocol handler
- If another app (like PuTTY) is already registered, Windows lets users choose
- Users control defaults via Settings → Apps → Default apps

#### Linux
- Registers via `.desktop` file
- Desktop environment determines handler selection behavior
- Users can set defaults in system settings

## Can I use deep links WITHOUT calling `registerDeepLink()`?

**Yes!** Deep link parsing and handling will still work. You just need to invoke electerm explicitly:

```bash
# macOS
open -a electerm "telnet://192.168.2.31:34554"

# Linux
/usr/bin/electerm "ssh://user@host:22"

# Windows
"C:\Program Files\electerm\electerm.exe" "telnet://192.168.2.31:34554"
```

Or users can right-click links and manually select "Open with Electerm".

## What happens if I DON'T call `registerDeepLink()`?

### ✅ Still works:
- Manual invocation with explicit app path
- Right-click → Open With → Electerm
- Running instances receiving URLs

### ❌ Won't work:
- Direct URL clicks in browsers (OS won't suggest electerm)
- System-wide protocol handling
- Simple `open telnet://...` commands

## How do I disable protocol registration?

### Option 1: Comment out the call
In `src/app/lib/create-app.js`:
```javascript
// registerDeepLink()  // Commented out
```

### Option 2: Use configuration flag
Modify the code to check a user setting:
```javascript
if (config.enableProtocolHandling !== false) {
  registerDeepLink()
}
```

### Option 3: Environment variable
Skip registration in development:
```bash
# Registration happens only if:
# - app.isPackaged = true, OR
# - ELECTERM_REGISTER_PROTOCOLS=1
```

## Can users unregister Electerm after installation?

**Yes!** Users can remove Electerm as a handler through system settings:

- **macOS**: System Preferences → Default Apps
- **Windows**: Settings → Apps → Default apps
- **Linux**: System Settings → Applications

The new `unregisterDeepLink()` function can also programmatically remove handlers:

```javascript
const { unregisterDeepLink } = require('./deep-link')

// Unregister specific protocols
unregisterDeepLink(['ssh', 'telnet'])

// Or all protocols
unregisterDeepLink()
```

## How can I check if protocols are registered?

Use the new `checkProtocolRegistration()` function:

```javascript
const { checkProtocolRegistration } = require('./deep-link')

const status = checkProtocolRegistration()
console.log(status)
// {
//   ssh: true,
//   telnet: false,
//   rdp: true,
//   vnc: false,
//   serial: true
// }
```

## What if users already have PuTTY or another SSH client?

**No conflict!** The registration is non-intrusive:

1. Both apps can be registered as handlers
2. Users choose which one to use (per protocol)
3. System settings let users switch anytime
4. No forced override of existing defaults

## Does this work in development mode?

By default, **NO** - to avoid cluttering your development environment.

To enable for testing:
```bash
ELECTERM_REGISTER_PROTOCOLS=1 npm start
```

Or use the force parameter:
```javascript
registerDeepLink(true)  // Force registration even in dev mode
```

## What's the difference between the old npm deeplink package and this implementation?

### This Implementation:
- ✅ No external dependencies
- ✅ Full control over behavior
- ✅ Cross-platform consistency
- ✅ Integrates with existing code
- ✅ Non-intrusive registration
- ✅ Better error handling

### Old npm packages:
- ❌ Extra dependencies to maintain
- ❌ Limited customization
- ❌ May have platform-specific issues
- ❌ Not always maintained

## Can I use this with electerm in portable mode?

**Yes!** Protocol registration works with portable installations. The registration points to the current executable location.

## Summary: Key Points

1. **Registration is OPTIONAL** - Deep links work without it, just less convenient
2. **Non-intrusive** - Doesn't force override of existing apps
3. **User controlled** - Users can always change defaults in system settings
4. **Fully functional** - URL parsing and tab opening works regardless of registration
5. **Configurable** - Can be disabled or made conditional on user preferences

## Recommendation

**Keep protocol registration enabled** for the best user experience, but:
- Document that it's non-intrusive
- Respect existing defaults
- Let users know they can change system settings
- Consider adding a settings toggle for users who prefer not to register

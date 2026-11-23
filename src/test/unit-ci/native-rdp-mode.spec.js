/**
 * Which client opens an RDP bookmark, and whether that leaves a tab.
 *
 * The decisions are pure: the platform is an optional last argument, so a test
 * can state it instead of patching globals (the live default reads platform.js,
 * which is false outside the app -- that is what the last cases pin down: a
 * bookmark asking to skip the tab must never skip it where there is no local
 * client, or the click would do nothing at all).
 *
 * Lives in unit-ci/ because src/test/unit/ is not wired into any npm script or
 * workflow.
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const WIN = { win: true, webApp: false }
const LINUX = { win: false, webApp: false }
const WEB_ON_WINDOWS_SERVER = { win: true, webApp: true }

let mod = null

// ESM, like every other client module a unit test loads (see
// bookmark-uncategorized.spec.js): platform.js imports nothing, so this works
// without the app or Electron.
async function getMod () {
  if (!mod) {
    mod = await import('../../client/common/native-rdp.js')
  }
  return mod
}

const bookmark = (extra = {}) => ({
  type: 'rdp',
  host: 'h',
  nativeRdp: true,
  ...extra
})

test('canUseNativeRdp needs the Windows desktop build', async () => {
  const { canUseNativeRdp } = await getMod()
  assert.equal(canUseNativeRdp(WIN), true)
  assert.equal(canUseNativeRdp(LINUX), false)
  // the web app's isWin is the server's platform, not the browser's
  assert.equal(canUseNativeRdp(WEB_ON_WINDOWS_SERVER), false)
})

test('isNativeRdpTab needs the bookmark flag and a Windows build', async () => {
  const { isNativeRdpTab } = await getMod()
  assert.equal(isNativeRdpTab(bookmark(), WIN), true)
  assert.equal(isNativeRdpTab(bookmark({ nativeRdp: false }), WIN), false)
  assert.equal(isNativeRdpTab(bookmark({ nativeRdp: undefined }), WIN), false)
  assert.equal(isNativeRdpTab(bookmark({ type: 'vnc' }), WIN), false)
  assert.equal(isNativeRdpTab(bookmark(), LINUX), false)
  assert.equal(isNativeRdpTab(bookmark(), WEB_ON_WINDOWS_SERVER), false)
  assert.equal(isNativeRdpTab(null, WIN), false)
})

test('opensWithoutTab only when the bookmark asks for it', async () => {
  const { opensWithoutTab } = await getMod()
  assert.equal(opensWithoutTab(bookmark({ nativeRdpTab: false }), WIN), true)
  // absent and true both keep the tab: that is what every bookmark written
  // before the option existed expects
  assert.equal(opensWithoutTab(bookmark(), WIN), false)
  assert.equal(opensWithoutTab(bookmark({ nativeRdpTab: undefined }), WIN), false)
  assert.equal(opensWithoutTab(bookmark({ nativeRdpTab: true }), WIN), false)
})

test('the tab is never skipped without a local client to open', async () => {
  const { opensWithoutTab } = await getMod()
  // no local client here: the built-in client is what runs, and it needs a tab
  assert.equal(opensWithoutTab(bookmark({ nativeRdpTab: false }), LINUX), false)
  assert.equal(
    opensWithoutTab(bookmark({ nativeRdpTab: false }), WEB_ON_WINDOWS_SERVER),
    false
  )
  // ...and a bookmark that only asked for the tab option, not the client, is
  // still a built-in session
  assert.equal(
    opensWithoutTab({ type: 'rdp', host: 'h', nativeRdpTab: false }, WIN),
    false
  )
})

test('the live default is "no local client" outside the app', async () => {
  const { canUseNativeRdp, isNativeRdpTab, opensWithoutTab } = await getMod()
  // platform.js reads window.pre, which does not exist under node
  assert.equal(canUseNativeRdp(), false)
  assert.equal(isNativeRdpTab(bookmark()), false)
  assert.equal(opensWithoutTab(bookmark({ nativeRdpTab: false })), false)
})

/**
 * The decision has to stay in one place: addTab used to be the only caller, and
 * a copy pasted into the store would drift from this module (the repo has been
 * bitten by duplicated guards before, see quick-connect-deeplink.spec.js).
 */
test('addTab asks this module instead of keeping its own copy', async () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../../src/client/store/tab.js'),
    'utf8'
  )
  assert.match(src, /import \{[^}]*opensWithoutTab[^}]*\} from '\.\.\/components\/rdp\/native-rdp\.js'/)
  assert.match(src, /if \(opensWithoutTab\(newTab\)\)/)
  // the skip path must record the attempt: addTab's own updateHistory() is
  // below the early return
  assert.match(
    src,
    /if \(opensWithoutTab\(newTab\)\) \{[\s\S]{0,400}window\.store\.updateHistory\(newTab\)[\s\S]{0,200}openNativeRdp\(newTab\)[\s\S]{0,80}return/
  )
})

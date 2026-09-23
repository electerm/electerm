const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

// Client-side (ESM) only: a .vv file is loaded by the renderer, both from the
// bookmark form's "Load .vv file" button and from a path handed to electerm on
// the command line. src/client/common/vv-to-tab.js is the only mapping from a
// parse result to a tab, so there is no server-side twin to keep in sync.

function runTests (getMod) {
  describe('isVvFile', () => {
    it('accepts a .vv path, in any casing', () => {
      const { isVvFile } = getMod()
      assert.strictEqual(isVvFile('/tmp/console.vv'), true)
      assert.strictEqual(isVvFile('console.VV'), true)
      assert.strictEqual(isVvFile('C:\\Users\\me\\Downloads\\vm.vV'), true)
      assert.strictEqual(isVvFile('  /tmp/console.vv  '), true)
    })

    it('rejects anything that is not a .vv path', () => {
      const { isVvFile } = getMod()
      assert.strictEqual(isVvFile('/tmp/console.vvx'), false)
      assert.strictEqual(isVvFile('/tmp/vv'), false)
      assert.strictEqual(isVvFile(''), false)
      assert.strictEqual(isVvFile(undefined), false)
      assert.strictEqual(isVvFile(null), false)
      assert.strictEqual(isVvFile(42), false)
      assert.strictEqual(isVvFile('user@host'), false)
    })

    it('rejects a deep link that happens to end in .vv', () => {
      const { isVvFile } = getMod()
      assert.strictEqual(isVvFile('spice://host/console.vv'), false)
      assert.strictEqual(isVvFile('electerm://host/x.vv'), false)
    })
  })

  describe('basename', () => {
    it('takes the last segment of a posix or windows path', () => {
      const { basename } = getMod()
      assert.strictEqual(basename('/a/b/console.vv'), 'console.vv')
      assert.strictEqual(basename('C:\\a\\b\\console.vv'), 'console.vv')
      assert.strictEqual(basename('console.vv'), 'console.vv')
    })
  })

  describe('vvToTab', () => {
    it('maps a plain file onto a spice tab', () => {
      const { parseVv } = getMod()
      const { vvToTab } = getMod()
      const parsed = parseVv('[virt-viewer]\ntype=spice\nhost=127.0.0.1\nport=5930\n')
      const tab = vvToTab(parsed, { filePath: '/tmp/plain.vv' })
      assert.strictEqual(tab.type, 'spice')
      assert.strictEqual(tab.host, '127.0.0.1')
      assert.strictEqual(tab.port, 5930)
      assert.strictEqual(tab.tls, false)
      assert.strictEqual(tab.viewOnly, false)
      assert.strictEqual(tab.scaleViewport, true)
      // falls back to the file name so the tab is identifiable
      assert.strictEqual(tab.title, 'plain.vv')
    })

    it('carries the TLS keys a Proxmox file sets', () => {
      const { parseVv } = getMod()
      const { vvToTab } = getMod()
      const parsed = parseVv([
        '[virt-viewer]',
        'type=spice',
        'host=pvespiceproxy:6ab1b34d:100:node1:5943::deadbeef',
        'proxy=http://10.0.0.1:3128',
        'tls-port=5943',
        'host-subject=C=CN,O=electerm spice-lab,CN=127.0.0.1',
        'password=s3cret',
        'title=VM 100',
        'ca=-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----'
      ].join('\n'))
      const tab = vvToTab(parsed, { filePath: '/tmp/pve.vv' })
      assert.strictEqual(tab.type, 'spice')
      assert.strictEqual(tab.port, 5943)
      assert.strictEqual(tab.tls, true)
      assert.strictEqual(tab.proxy, 'http://10.0.0.1:3128')
      assert.strictEqual(tab.hostSubject, 'C=CN,O=electerm spice-lab,CN=127.0.0.1')
      assert.strictEqual(tab.password, 's3cret')
      // the file's own title wins over the file name
      assert.strictEqual(tab.title, 'VM 100')
      assert.match(tab.ca, /^-----BEGIN CERTIFICATE-----\nMIIB\n/)
    })

    it('leaves an absent ca/hostSubject/password out entirely', () => {
      const { parseVv } = getMod()
      const { vvToTab } = getMod()
      const parsed = parseVv('[virt-viewer]\ntype=spice\nhost=10.0.0.9\ntls-port=5901\n')
      const tab = vvToTab(parsed, { filePath: '/tmp/x.vv' })
      // An empty string here would mean "pin nothing", which fails every
      // handshake -- the session code reads an absent ca as "do not pin".
      assert.strictEqual('ca' in tab, false)
      assert.strictEqual('hostSubject' in tab, false)
      assert.strictEqual('password' in tab, false)
      assert.strictEqual('proxy' in tab, false)
    })

    it('defaults the port when the file names none', () => {
      const { parseVv } = getMod()
      const { vvToTab } = getMod()
      const parsed = parseVv('[virt-viewer]\ntype=spice\nhost=10.0.0.9\n')
      assert.strictEqual(vvToTab(parsed).port, 5900)
    })

    it('lets the caller override, and keeps filePath out of the tab', () => {
      const { parseVv } = getMod()
      const { vvToTab } = getMod()
      const parsed = parseVv('[virt-viewer]\ntype=spice\nhost=10.0.0.9\nport=1\n')
      const tab = vvToTab(parsed, {
        filePath: '/tmp/x.vv',
        title: 'from the command line',
        viewOnly: true
      })
      assert.strictEqual(tab.title, 'from the command line')
      assert.strictEqual(tab.viewOnly, true)
      assert.strictEqual('filePath' in tab, false)
    })

    it('omits the title when there is no file and no title key', () => {
      const { parseVv } = getMod()
      const { vvToTab } = getMod()
      const parsed = parseVv('[virt-viewer]\ntype=spice\nhost=10.0.0.9\n')
      assert.strictEqual('title' in vvToTab(parsed), false)
    })
  })
}

describe('vv-to-tab — src/client/common/vv-to-tab.js (ESM)', () => {
  let vvMod
  let parseMod
  before(async () => {
    parseMod = await import('../../../src/client/common/parse-vv.js')
    vvMod = await import('../../../src/client/common/vv-to-tab.js')
  })

  runTests(() => ({ ...vvMod, ...parseMod }))
})

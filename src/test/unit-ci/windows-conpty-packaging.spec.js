const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

describe('Windows ConPTY packaging', () => {
  it('copies the selected architecture runtime DLL and OpenConsole into the unpacked app', async () => {
    const { copyConptyRuntime } = require('../../../build/bin/after-pack')
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-conpty-'))
    const nodePtyRoot = path.join(root, 'node_modules', 'node-pty')
    const versionDir = path.join(nodePtyRoot, 'third_party', 'conpty', 'test-version', 'win10-x64')
    const appOutDir = path.join(root, 'dist', 'win-unpacked')
    fs.mkdirSync(versionDir, { recursive: true })
    fs.writeFileSync(path.join(versionDir, 'conpty.dll'), 'dll-runtime')
    fs.writeFileSync(path.join(versionDir, 'OpenConsole.exe'), 'console-runtime')
    try {
      copyConptyRuntime({ nodePtyRoot, appOutDir, arch: 'x64' })
      const destination = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'node-pty', 'build', 'Release', 'conpty')
      assert.equal(fs.readFileSync(path.join(destination, 'conpty.dll'), 'utf8'), 'dll-runtime')
      assert.equal(fs.readFileSync(path.join(destination, 'OpenConsole.exe'), 'utf8'), 'console-runtime')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

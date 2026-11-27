const fs = require('node:fs')
const path = require('node:path')

// ProxyCommand splits on whitespace. Relative paths keep both arguments
// intact when the checkout or Node installation path contains spaces.
function createProxyFixture () {
  const dir = fs.mkdtempSync('.electerm-test-proxy-')
  const runtime = path.join(dir, 'runtime')
  try {
    fs.symlinkSync(path.dirname(process.execPath), runtime, 'junction')
  } catch (err) {
    fs.rmdirSync(dir)
    throw err
  }
  return {
    dir,
    node: path.join(runtime, path.basename(process.execPath)),
    dispose () {
      fs.unlinkSync(runtime)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}

module.exports = { createProxyFixture }

const fs = require('node:fs')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')

const maxRetries = 3
const retryDelay = 100

async function removeProxyFixture (dir) {
  const runtime = path.join(dir, 'runtime')
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.unlink(runtime)
      break
    } catch (err) {
      if (err.code === 'ENOENT') break
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code) || attempt === maxRetries) throw err
      await delay(retryDelay * (attempt + 1))
    }
  }
  // Windows may hold the child's working directory open until the process
  // exits. Only the scratch files remain after unlinking the runtime junction.
  await fs.promises.rm(dir, { recursive: true, force: true, maxRetries, retryDelay })
}

// ProxyCommand splits on whitespace. Relative paths keep both arguments
// intact when the checkout or Node installation path contains spaces.
function createProxyFixture (nodePath = process.execPath) {
  const dir = fs.mkdtempSync('.electerm-test-proxy-')
  const absoluteDir = path.resolve(dir)
  const runtime = path.join(dir, 'runtime')
  try {
    fs.symlinkSync(path.dirname(nodePath), runtime, 'junction')
  } catch (err) {
    fs.rmdirSync(dir)
    throw err
  }
  let disposal
  return {
    dir,
    node: path.join(runtime, path.basename(nodePath)),
    dispose () {
      if (!disposal) {
        disposal = removeProxyFixture(absoluteDir).catch(err => {
          disposal = undefined
          throw err
        })
      }
      return disposal
    }
  }
}

module.exports = { createProxyFixture }

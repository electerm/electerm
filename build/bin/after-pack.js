const fs = require('node:fs')
const path = require('node:path')

function copyConptyRuntime ({ nodePtyRoot, appOutDir, arch }) {
  if (!['x64', 'arm64'].includes(arch)) return
  const conptyRoot = path.join(nodePtyRoot, 'third_party', 'conpty')
  const version = fs.readdirSync(conptyRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]
  if (!version) throw new Error(`node-pty ConPTY runtime was not found in ${conptyRoot}`)

  const source = path.join(conptyRoot, version, `win10-${arch}`)
  const destination = path.join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'node-pty',
    'build',
    'Release',
    'conpty'
  )
  fs.mkdirSync(destination, { recursive: true })
  for (const filename of ['conpty.dll', 'OpenConsole.exe']) {
    const sourceFile = path.join(source, filename)
    if (!fs.existsSync(sourceFile)) {
      throw new Error(`node-pty ConPTY runtime file missing: ${sourceFile}`)
    }
    fs.copyFileSync(sourceFile, path.join(destination, filename))
  }
}

async function afterPack (context) {
  if (context.electronPlatformName !== 'win32') return
  const arch = context.arch === 3 ? 'arm64' : (context.arch === 1 ? 'x64' : '')
  if (!arch) return
  copyConptyRuntime({
    nodePtyRoot: path.resolve(__dirname, '../../node_modules/node-pty'),
    appOutDir: context.appOutDir,
    arch
  })
}

exports.default = afterPack
exports.copyConptyRuntime = copyConptyRuntime

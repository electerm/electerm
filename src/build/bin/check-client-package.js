const { readdirSync } = require('node:fs')
const { dirname, isAbsolute, relative, resolve, sep } = require('node:path')

// electerm-react ships the client tree as source. Check every module, including
// ones a web consumer can import without going through the desktop entry point.
async function checkClientPackage (clientDir) {
  const { build } = await import('vite')
  const input = readdirSync(clientDir, { recursive: true })
    .filter(file => /\.(?:[cm]?js|jsx)$/.test(file))
    .map(file => resolve(clientDir, file))

  await build({
    configFile: false,
    root: clientDir,
    publicDir: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: false,
      rolldownOptions: {
        input,
        external (id, importer) {
          if (!importer) return false
          if (/^\/?src\/app\//.test(id)) {
            throw new Error(`${importer} imports server source: ${id}`)
          }
          if (!id.startsWith('.') && !isAbsolute(id)) return true
          const target = relative(clientDir, resolve(dirname(importer), id))
          if (target === '..' || target.startsWith('..' + sep) || isAbsolute(target)) {
            throw new Error(`${importer} imports outside the published client directory: ${id}`)
          }
          return false
        }
      }
    }
  })
}

module.exports = checkClientPackage

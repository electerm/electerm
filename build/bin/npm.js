const fs = require('fs')
const path = require('path')
const axios = require('axios')
const tar = require('tar')

// npm similar function for electron
// load module and deps recursively into electron app's data folder/node_modules
// we need directly download tarball and extract use tar lib
// so that it can be used in main process

/**
 * Install an npm module by downloading its tarball and extracting it to node_modules
 * Recursively installs all dependencies.
 * @param {string} moduleName - The npm package name
 * @param {string} [version] - The version to install (default: latest)
 * @param {string} pathDownload - The base path to download and extract to (e.g. electron data folder)
 * @param {Set<string>} [installed] - Internal set to avoid duplicate installs
 */
async function install (moduleName, version = 'latest', pathDownload, installed = new Set()) {
  const key = `${moduleName}@${version}`
  if (installed.has(key)) return
  installed.add(key)
  // 1. Get tarball url from npm registry
  const registry = 'https://registry.npmjs.org/'
  const metaUrl = `${registry}${moduleName.replace('/', '%2F')}`
  const metaRes = await fetch(metaUrl)
  if (!metaRes.ok) throw new Error(`Failed to fetch meta for ${moduleName}`)
  const meta = await metaRes.json()
  const ver = version === 'latest' ? meta['dist-tags'].latest : version
  const tarballUrl = meta.versions[ver]?.dist?.tarball
  if (!tarballUrl) throw new Error(`Tarball not found for ${moduleName}@${ver}`)

  // 2. Download tarball using axios
  const nodeModulesDir = path.resolve(pathDownload, 'node_modules')
  if (!fs.existsSync(nodeModulesDir)) fs.mkdirSync(nodeModulesDir, { recursive: true })
  const pkgDir = path.join(nodeModulesDir, moduleName)
  if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true })
  const tarballPath = path.join(pkgDir, `${moduleName.replace('/', '-')}-${ver}.tgz`)
  const response = await axios.get(tarballUrl, { responseType: 'arraybuffer' })
  fs.writeFileSync(tarballPath, response.data)

  // 3. Extract tarball
  await tar.x({
    file: tarballPath,
    cwd: pkgDir,
    strip: 1 // remove package/ prefix
  })
  fs.unlinkSync(tarballPath)
  console.log(`Installed ${moduleName}@${ver} to ${pkgDir}`)

  // 4. Recursively install dependencies
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    const deps = pkgJson.dependencies || {}
    for (const [dep, depVer] of Object.entries(deps)) {
      // depVer may be a range, but we use as-is for simplicity
      await install(dep, depVer, pathDownload, installed)
    }
  }
}

module.exports = { install }

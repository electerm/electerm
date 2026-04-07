const path = require('path')
const fs = require('fs')
const tar = require('tar')
const axios = require('axios')
const { pipeline } = require('stream/promises')

const npmRegistry = (process.env.NPM_REGISTRY || 'https://registry.npmjs.org').replace(/\/$/, '')

async function fetchManifest (packageName) {
  const encoded = packageName.replace('/', '%2f')
  const { data } = await axios.get(`${npmRegistry}/${encoded}/latest`)
  return data
}

async function extractTarball (tarballUrl, destDir) {
  const { data: stream } = await axios.get(tarballUrl, { responseType: 'stream' })
  fs.mkdirSync(destDir, { recursive: true })
  await pipeline(
    stream,
    require('zlib').createGunzip(),
    tar.extract({ cwd: destDir, strip: 1 })
  )
}

async function installPackage (packageName, targetFolder, visited = new Set()) {
  const cacheKey = `${packageName}@${npmRegistry}`
  if (visited.has(cacheKey)) {
    return
  }
  visited.add(cacheKey)

  const packageDir = path.join(targetFolder, 'node_modules', packageName)
  if (fs.existsSync(packageDir)) {
    return
  }

  const manifest = await fetchManifest(packageName)
  const tarballUrl = manifest.dist && manifest.dist.tarball
  if (!tarballUrl) {
    throw new Error(`No tarball URL found for ${packageName}`)
  }

  await extractTarball(tarballUrl, packageDir)

  const deps = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies
  }

  for (const [depName] of Object.entries(deps || {})) {
    await installPackage(depName, targetFolder, visited)
  }
}

exports.downloadPackage = async (packageName, targetFolder) => {
  const npmPath = path.join(targetFolder, 'node_modules', packageName)
  if (fs.existsSync(npmPath)) {
    return npmPath
  }

  await installPackage(packageName, targetFolder)

  return npmPath
}

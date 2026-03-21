const path = require('path')
const fs = require('fs')
const pacote = require('pacote')

const npmRegistry = process.env.NPM_REGISTRY || 'https://registry.npmjs.org'

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

  fs.mkdirSync(path.join(targetFolder, 'node_modules'), { recursive: true })
  fs.mkdirSync(packageDir, { recursive: true })

  await pacote.extract(packageName, packageDir, {
    registry: npmRegistry
  })

  const manifest = await pacote.manifest(packageName, {
    registry: npmRegistry
  })

  const deps = {
    ...manifest.dependencies,
    ...manifest.optionalDependencies
  }

  for (const [depName] of Object.entries(deps)) {
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

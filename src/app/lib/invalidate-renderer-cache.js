const { existsSync, readFileSync, writeFileSync, rmSync, statSync } = require('fs')
const { join } = require('path')
const log = require('../common/log')

function getBuildFingerprint (app) {
  try {
    const appPath = app.getAppPath()
    const stat = statSync(appPath)
    return JSON.stringify({
      version: app.getVersion(),
      path: appPath,
      mtimeMs: stat.mtimeMs,
      size: stat.size || 0
    })
  } catch (error) {
    log.warn('failed to build cache fingerprint', error)
    return ''
  }
}

function safeRemoveDir (path) {
  try {
    if (existsSync(path)) {
      rmSync(path, {
        recursive: true,
        force: true
      })
    }
  } catch (error) {
    log.warn(`failed to remove cache dir: ${path}`, error)
  }
}

async function invalidateRendererCacheIfNeeded (app) {
  if (!app.isPackaged) {
    return
  }
  const fingerprint = getBuildFingerprint(app)
  if (!fingerprint) {
    return
  }
  const userData = app.getPath('userData')
  const marker = join(userData, 'renderer-build-fingerprint.json')
  let prevFingerprint = ''
  try {
    if (existsSync(marker)) {
      prevFingerprint = readFileSync(marker, 'utf8')
    }
  } catch (error) {
    log.warn('failed to read renderer fingerprint marker', error)
  }
  if (prevFingerprint === fingerprint) {
    return
  }

  ;[
    'Cache',
    'Code Cache',
    'GPUCache',
    'DawnGraphiteCache',
    'DawnWebGPUCache'
  ].forEach(dir => {
    safeRemoveDir(join(userData, dir))
  })

  try {
    writeFileSync(marker, fingerprint)
  } catch (error) {
    log.warn('failed to write renderer fingerprint marker', error)
  }
}

module.exports = {
  invalidateRendererCacheIfNeeded
}

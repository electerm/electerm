// electron-builder afterPack hook, also used on the final cross-built tree.
const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')

function prepareLinuxTar (dir, asset) {
  if (!/^electerm-\d+\.\d+\.\d+-linux-[a-z0-9_]+(?:-legacy)?\.tar\.gz$/.test(asset)) {
    throw new Error('Unexpected Linux archive name: ' + asset)
  }
  const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8')
  const digest = createHash('sha256').update(fs.readFileSync(path.join(dir, 'chrome-sandbox'))).digest('hex')
  const launcher = read('linux-tar-launcher.sh')
    .replaceAll('@HELPER_SHA256@', digest)
    .replace('@VARIANT@', asset.split('-linux-')[1].slice(0, -7))
    .replace('@ASSET@', asset)
    .replace('@INSTALL_SCRIPT@', () => read('linux-tar-install-sandbox.sh').trim())
  fs.renameSync(path.join(dir, 'electerm'), path.join(dir, 'electerm-bin'))
  fs.writeFileSync(path.join(dir, 'electerm'), launcher, { mode: 0o755, flag: 'wx' })
}

module.exports = function afterPack ({ appOutDir, packager }) {
  const src = require('../../../work/app/lib/install-src.js')
  prepareLinuxTar(appOutDir, 'electerm-' + packager.appInfo.version + '-' + src)
}

if (require.main === module) prepareLinuxTar(process.argv[2], process.argv[3])

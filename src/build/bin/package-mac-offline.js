const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { finished } = require('stream/promises')
const { createHash } = require('crypto')
const { createPackageWithOptions, getRawHeader } = require('@electron/asar')
const { getPath7za } = require('app-builder-lib/out/toolsets/7zip')
const unzipper = require('unzipper')
const plist = require('plist')

exports.packageMacOffline = async function (root, outputDir) {
  const version = require('../../../package.json').version
  const electronVersion = require('../../../package.json').devDependencies.electron
  const runtime = path.join(root, '.cache/electron', `electron-v${electronVersion}-darwin-arm64.zip`)
  if (!fs.existsSync(runtime)) throw new Error('Download the official darwin-arm64 Electron runtime to .cache/electron first')
  const payload = path.join(root, '.cache/mac-payload')
  if (!payload.startsWith(root + path.sep)) throw new Error('Invalid staging directory')
  fs.rmSync(payload, { recursive: true, force: true })
  const contents = path.join(payload, 'Electron.app/Contents')
  const resources = path.join(contents, 'Resources')
  fs.mkdirSync(resources, { recursive: true })
  const runtimeZip = await unzipper.Open.file(runtime)
  const info = plist.parse((await runtimeZip.files.find(f => f.path === 'Electron.app/Contents/Info.plist').buffer()).toString())
  Object.assign(info, {
    CFBundleDisplayName: 'Electerm Terminal',
    CFBundleName: 'Electerm Terminal',
    CFBundleIdentifier: 'local.electerm.terminal',
    CFBundleShortVersionString: version,
    CFBundleVersion: version
  })
  const archivePath = path.join(resources, 'app.asar')
  const archive = await createPackageWithOptions(path.join(root, 'work/app'), archivePath, {
    unpack: '**/node-pty/prebuilds/**',
    globOptions: {
      ignore: [
        '**/widgets/!(paths.js)', '**/mcp/**', '**/lib/ai*.js',
        '**/server/session-{rdp,vnc,spice,serial,telnet,ftp}.js',
        '**/server/{rdp-proxy,spice-proxy,ftp-client,ftp-file,ftp-transfer,sync,webdav-sync}.js',
        '**/node-pty/{src,deps,third_party}/**',
        '**/node-pty/prebuilds/{win32-*,linux-*,darwin-x64}/**'
      ]
    }
  })
  // asar 3 resolves with the ending WriteStream, before its file is closed.
  await finished(archive)
  info.ElectronAsarIntegrity = {
    'Resources/app.asar': {
      algorithm: 'SHA256',
      hash: createHash('sha256').update(getRawHeader(archivePath).headerString).digest('hex')
    }
  }
  fs.writeFileSync(path.join(contents, 'Info.plist'), plist.build(info))
  fs.copyFileSync(path.join(__dirname, 'prepare-mac.command'), path.join(payload, 'Prepare-Mac.command'))
  const output = path.join(outputDir, `Electerm-Terminal-${version}-mac-arm64-unsigned.zip`)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.copyFileSync(runtime, output)
  const sevenZip = await getPath7za()
  execFileSync(sevenZip, ['d', output, 'Electron.app/Contents/Resources/default_app.asar', 'Electron.app/Contents/_CodeSignature/*'], { stdio: 'inherit' })
  execFileSync(sevenZip, ['a', output, 'Electron.app', 'Prepare-Mac.command'], { cwd: payload, stdio: 'inherit' })
  console.log('Created unsigned ARM64 package:', output)
  console.log('On the Mac: run bash Prepare-Mac.command once to apply a local ad-hoc signature.')
}

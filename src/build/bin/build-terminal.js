const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '../../..')
const appDir = path.join(root, 'work/app')
const cache = path.join(root, '.cache')
const target = process.argv[2] || 'win'
const output = process.argv.includes('--staging')
  ? path.join(cache, 'terminal-release')
  : path.join(root, 'dist', 'classic-r7')
if (!['win', 'mac', 'both', 'prepare'].includes(target)) {
  throw new Error('Usage: node src/build/bin/build-terminal.js [win|mac|both|prepare]')
}
for (const dir of ['tmp', 'npm', 'electron', 'electron-builder']) {
  fs.mkdirSync(path.join(cache, dir), { recursive: true })
}
Object.assign(process.env, {
  npm_config_cache: path.join(cache, 'npm'),
  ELECTRON_CACHE: path.join(cache, 'electron'),
  ELECTRON_BUILDER_CACHE: path.join(cache, 'electron-builder'),
  TEMP: path.join(cache, 'tmp'),
  TMP: path.join(cache, 'tmp'),
  TMPDIR: path.join(cache, 'tmp'),
  NODE_ENV: 'production',
  CSC_IDENTITY_AUTO_DISCOVERY: 'false'
})

function run (script, args = [], cwd = root) {
  execFileSync(process.execPath, [require.resolve(script), ...args], {
    cwd,
    env: process.env,
    stdio: 'inherit'
  })
}

function prepare () {
  if (!appDir.startsWith(root + path.sep)) throw new Error('Invalid output directory')
  fs.rmSync(appDir, { recursive: true, force: true })
  run(path.join(root, 'node_modules/vite/bin/vite.js'), ['build', '--config', 'conf.js'], path.join(root, 'src/build/vite'))
  run('./copy.js')
  run('./pug.js')
  fs.cpSync(path.join(root, 'src/app'), appDir, { recursive: true })
  const localeDir = path.join(root, 'node_modules/@electerm/electerm-locales/dist/cjs')
  const choices = require(path.join(localeDir, 'list.json')).map(file => {
    const { name, match } = require(path.join(localeDir, file))
    return { id: path.basename(file, '.js'), name, reg: match }
  })
  fs.writeFileSync(path.join(appDir, 'locale-choices.json'), JSON.stringify(choices))
  const pack = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const omitted = ['@electerm/ftp-srv', 'basic-ftp', 'electerm-sync', 'serialport']
  const dependencies = { ...pack.dependencies }
  for (const name of omitted) delete dependencies[name]
  // These entry URLs do not change when rebuilding the same upstream version.
  // Their contents also identify the hashed chunks imported by the entries.
  const uiHash = createHash('sha256')
  for (const file of ['index.html', `css/style-${pack.version}.css`, ...['basic', 'electerm', 'worker'].map(name => `js/${name}-${pack.version}.js`)]) {
    uiHash.update(fs.readFileSync(path.join(appDir, 'assets', file)))
  }
  const appPack = {
    name: 'electerm-terminal',
    productName: 'Electerm Terminal',
    version: pack.version,
    uiRevision: uiHash.digest('hex'),
    description: 'Local terminal, SSH and SFTP',
    main: 'app.js',
    author: pack.author,
    license: pack.license,
    dependencies
  }
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(appPack, null, 2))
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(appDir, 'LICENSE'))
  const copied = new Set()
  function copyDependency (name, parent, optional = false) {
    if (name === 'cpu-features') return
    let current = parent
    let source
    while (current.startsWith(root)) {
      const candidate = path.join(current, 'node_modules', name)
      if (fs.existsSync(path.join(candidate, 'package.json'))) {
        source = candidate
        break
      }
      if (current === root) break
      current = path.dirname(current)
    }
    if (!source) {
      if (optional) return
      throw new Error(`Missing dependency: ${name} required by ${parent}`)
    }
    if (copied.has(source)) return
    copied.add(source)
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
    const destination = path.join(appDir, path.relative(root, source))
    fs.cpSync(source, destination, {
      recursive: true,
      filter: file => {
        const relative = path.relative(source, file)
        return !/(^|[/\\])(node_modules|test|tests|example|examples|\.github)([/\\]|$)/.test(relative) &&
          !/\.(map|pdb|ts)$/.test(file)
      }
    })
    for (const dep of Object.keys(manifest.dependencies || {})) copyDependency(dep, source)
    for (const dep of Object.keys(manifest.optionalDependencies || {})) copyDependency(dep, source, true)
  }
  for (const name of Object.keys(dependencies)) copyDependency(name, root)
  console.log(`Prepared ${copied.size} runtime packages without installing additional dependencies`)
}

async function main () {
  if (target === 'both' || target === 'win') {
    if (fs.existsSync(path.join(output, 'win-unpacked', '.runtime'))) {
      throw new Error('Portable user data found in output; build in a separate checkout or move the unpacked app first')
    }
  }
  prepare()
  if (target === 'prepare') return
  if (target === 'mac' && process.platform !== 'darwin') {
    await require('./package-mac-offline').packageMacOffline(root, output)
    return
  }
  const { build, Platform, Arch } = require('electron-builder')
  await build({
    targets: target !== 'mac'
      ? Platform.WINDOWS.createTarget(['zip'], Arch.x64)
      : Platform.MAC.createTarget(['zip'], Arch.arm64),
    config: {
      appId: 'local.electerm.terminal',
      productName: 'Electerm Terminal',
      electronVersion: require('../../../package.json').devDependencies.electron,
      electronDist: fs.existsSync(path.join(cache, 'electron', `electron-v${require('../../../package.json').devDependencies.electron}-${target !== 'mac' ? 'win32-x64' : 'darwin-arm64'}.zip`))
        ? path.join(cache, 'electron', `electron-v${require('../../../package.json').devDependencies.electron}-${target !== 'mac' ? 'win32-x64' : 'darwin-arm64'}.zip`)
        : undefined,
      directories: {
        app: appDir,
        output,
        buildResources: path.join(root, 'node_modules/@electerm/electerm-resource/build-res')
      },
      // eslint-disable-next-line no-template-curly-in-string
      artifactName: 'Electerm-Terminal-${version}-${os}-${arch}.${ext}',
      npmRebuild: false,
      asar: true,
      asarUnpack: ['node_modules/node-pty/prebuilds/**'],
      files: [
        '**/*',
        '!widgets/!(paths.js)', '!mcp/**', '!lib/ai*.js',
        '!server/session-{rdp,vnc,spice,serial,telnet,ftp}.js',
        '!server/{rdp-proxy,spice-proxy,ftp-client,ftp-file,ftp-transfer,sync,webdav-sync}.js',
        '!node_modules/node-pty/{src,deps,third_party}/**',
        '!node_modules/node-pty/prebuilds/{linux-*,darwin-x64,win32-arm64}/**'
      ],
      win: {
        icon: path.join(root, 'node_modules/@electerm/electerm-resource/build/icons-win.ico'),
        signAndEditExecutable: false
      },
      mac: {
        icon: path.join(root, 'node_modules/@electerm/electerm-resource/build/icons.icns'),
        identity: null,
        hardenedRuntime: false,
        notarize: false
      },
      publish: null
    },
    publish: 'never'
  })
  if (target === 'both') await require('./package-mac-offline').packageMacOffline(root, output)
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})

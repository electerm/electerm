/**
 * 快速测试打包（绕过 electron-builder / 重型 prepare）
 *
 * 思路：
 *   1. 仅用 @electron/asar 把已准备好的 work/app 打成 app.asar；
 *   2. 复用 electron 运行时目录（node_modules/electron/dist，electron 42），
 *      替换为我们的 app.asar，得到 opt/electerm 运行时；
 *   3. 用 dpkg-deb 直接打出 deb（自带图标/desktop/control/postinst/postrm 模板）。
 *
 * 优点：
 *   - 不依赖 electron-builder，规避 node20 不支持 require(ESM) 的打包崩溃；
 *   - 不改任何 package.json 的 version，运行时 packInfo.version 与编译产物
 *     （electerm-${base}.js）天然一致，不会卡 splash；
 *   - work/app 只首次 prepare 一次（装生产依赖 + 重建 node-pty），之后只重编译
 *     客户端 + 重新 asar + 打 deb，循环极快。
 *
 * 用法：
 *   npm run bdebfast                 # 重编译客户端 + 打自增 test deb
 *   node build/bin/build-deb-fast.js --skip-compile  # 跳过 vite 编译（仅改了非客户端资源时）
 *   node build/bin/build-deb-fast.js --prepare       # 强制重新 prepare work/app
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const workApp = path.join(root, 'work/app')
const electronDist = path.join(root, 'node_modules/electron/dist')
const stage = path.join(root, 'dist/deb-stage')
const templateDir = path.join(root, 'build/deb-template')
const counterPath = path.join(root, '.test-build-num')
const distDir = path.join(root, 'dist')

const args = process.argv.slice(2)
const skipCompile = args.includes('--skip-compile')
const forcePrepare = args.includes('--prepare')

function echo (s) { process.stdout.write(s + '\n') }
function run (cmd) {
  echo('$ ' + cmd)
  execSync(cmd, { stdio: 'inherit' })
}
function readJson (p) { return JSON.parse(fs.readFileSync(p, 'utf8')) }
function writeJson (p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2)) }
function exists (p) { return fs.existsSync(p) }

// 0. 前置检查
if (!exists(electronDist)) {
  echo('[deb-fast] 错误：未找到 electron 运行时（node_modules/electron/dist），请先安装 electron 42。')
  process.exit(1)
}
if (!exists(workApp)) {
  echo('[deb-fast] 提示：work/app 不存在，将自动执行首次 prepare。')
}

// 1. 自增测试版本号
let num = 0
if (exists(counterPath)) {
  num = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10) || 0
}
num += 1
fs.writeFileSync(counterPath, String(num))
const base = readJson(path.join(root, 'package.json')).version // 5.0.6（不改它）
const debVersion = `${base}~test.${num}` // DEBIAN control 里的版本（~ 为预发布分隔符）
const fileName = `electerm-${base}-test.${num}-linux-amd64.deb`
echo(`[deb-fast] 测试版本：${debVersion}  ->  dist/${fileName}`)

// 2. 重编译客户端到 work/app/assets（源码变更时必需）
// 注：--prepare 或首次运行会整目录重建 work/app（连带清掉刚编译的 assets），
// 此时先跳过，等 prepare 完成后在第 3 步末尾统一编译
if (skipCompile) {
  echo('[deb-fast] 跳过 compile（--skip-compile）')
} else if (!appReady()) {
  echo('[deb-fast] work/app 未就绪，compile 移至 prepare 之后执行')
} else {
  // 清理 vite 产出的版本化目录（js/css/chunk/assets），避免 3.15.186 等历史残留
  // 用 fs 直接删，避免 shell 引号导致 glob 不展开的问题
  ;['js', 'css', 'chunk', 'assets'].forEach(d => {
    fs.rmSync(path.join(workApp, 'assets', d), { recursive: true, force: true })
  })
  run('npm run compile')
}

// 3. 准备 work/app（仅首次或 --prepare：复制 src/app + 装生产依赖 + 重建 node-pty）
function appReady () {
  if (!exists(path.join(workApp, 'node_modules'))) return false
  return exists(path.join(workApp, 'node_modules', 'node-pty', 'build', 'Release', 'pty.node'))
}
if (forcePrepare || !appReady()) {
  echo('[deb-fast] work/app 未就绪，执行 prepare（首次较慢）...')
  fs.rmSync(workApp, { recursive: true, force: true })
  fs.mkdirSync(workApp, { recursive: true })
  run(`cp -r "${path.join(root, 'src/app')}/." "${workApp}/"`)
  // 生成 work/app/package.json（去掉 devDeps/scripts 等）
  const p = readJson(path.join(root, 'package.json'))
  delete p.devDependencies
  delete p.scripts
  delete p.standard
  delete p.files
  delete p.engines
  delete p.preferGlobal
  p.main = 'app.js'
  writeJson(path.join(workApp, 'package.json'), p)
  run(`cd "${workApp}" && npm i --omit=dev --legacy-peer-deps && cd "${root}"`)
  run(`npx electron-rebuild -f -m "${workApp}"`)
  // 清理 windows 专用文件（省体积）
  run(`rm -rf "${path.join(workApp, 'node_modules/node-pty/lib/windows*')}" "${path.join(workApp, 'node_modules/node-pty/deps/winpty')}"`)
  // prepare 整目录重建了 work/app，渲染层 assets 需要重新编译
  // （修复 --prepare / 首次运行时 assets 被连带删除导致 "Cannot GET /index.html" 的问题）
  run('npm run compile')
} else {
  echo('[deb-fast] work/app 已就绪，跳过 prepare')
}

// 4. 构建 stage/opt/electerm 运行时（仅首次从 electron dist 复制，之后复用）
const optDir = path.join(stage, 'opt', 'electerm')
if (!exists(path.join(optDir, 'electerm'))) {
  echo('[deb-fast] 首次构建运行时（复制 electron 42 到 stage）...')
  fs.rmSync(optDir, { recursive: true, force: true })
  fs.mkdirSync(optDir, { recursive: true })
  run(`cp -r "${electronDist}/." "${optDir}/"`)
  // 二进制改名为 electerm（electron 运行时）
  if (exists(path.join(optDir, 'electron'))) {
    fs.renameSync(path.join(optDir, 'electron'), path.join(optDir, 'electerm'))
  }
  // 删除 default_app.asar（electron 优先加载 app.asar）
  fs.rmSync(path.join(optDir, 'default_app.asar'), { force: true })
} else {
  echo('[deb-fast] 复用已构建的 stage 运行时（electron 42）')
}

// 5. 复制 deb 元数据模板（图标/desktop/doc + postinst/postrm）
run(`rm -rf "${path.join(stage, 'usr')}"`)
run(`cp -r "${path.join(templateDir, 'usr')}" "${path.join(stage, 'usr')}"`)
// 创建 /usr/bin/electerm 软链（命令行可直接 `electerm` 启动）
const binDir = path.join(stage, 'usr', 'bin')
fs.mkdirSync(binDir, { recursive: true })
const binLink = path.join(binDir, 'electerm')
try { fs.unlinkSync(binLink) } catch (e) {}
fs.symlinkSync('/opt/electerm/electerm', binLink)
fs.mkdirSync(path.join(stage, 'DEBIAN'), { recursive: true })

// 6. 打包 app.asar（解包原生 .node，否则 node-pty/serialport 在 asar 内加载失败）
const resDir = path.join(optDir, 'resources')
const appAsar = path.join(resDir, 'app.asar')
fs.rmSync(appAsar, { force: true })
fs.rmSync(appAsar + '.unpacked', { recursive: true, force: true })
run(`npx asar pack "${workApp}" "${appAsar}" --unpack "*.node"`)
echo(`[deb-fast] 已生成 app.asar（${Math.round(fs.statSync(appAsar).size / 1024 / 1024)} MB）`)

// 7. 写 DEBIAN/control
const duKb = execSync(`du -sk "${optDir}"`).toString().split(/\s+/)[0]
const control = [
  'Package: electerm',
  `Version: ${debVersion}`,
  'License: MIT',
  'Vendor: ZHAO Xudong <zxdong@gmail.com>',
  'Architecture: amd64',
  'Maintainer: ZHAO Xudong <zxdong@gmail.com>',
  `Installed-Size: ${duKb}`,
  'Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0',
  'Recommends: libappindicator3-1',
  'Section: default',
  'Priority: optional',
  'Homepage: https://electerm.org',
  'Description:',
  '  Terminal/ssh/telnet/serialport/sftp client(linux, mac, win)'
].join('\n') + '\n'
fs.writeFileSync(path.join(stage, 'DEBIAN', 'control'), control)
run(`cp "${path.join(templateDir, 'DEBIAN', 'postinst')}" "${path.join(stage, 'DEBIAN', 'postinst')}"`)
run(`cp "${path.join(templateDir, 'DEBIAN', 'postrm')}" "${path.join(stage, 'DEBIAN', 'postrm')}"`)

// 8. 用 fakeroot + dpkg-deb 打 deb（fakeroot 让文件属主为 root，符合规范）
fs.mkdirSync(distDir, { recursive: true })
const outDeb = path.join(distDir, fileName)
fs.rmSync(outDeb, { force: true })
const fakeroot = execSync('command -v fakeroot').toString().trim()
const buildCmd = `${fakeroot} dpkg-deb --build "${stage}" "${outDeb}"`
run(buildCmd)
echo(`\n[deb-fast] 完成：${outDeb}`)
echo('[deb-fast] 提示：stage 已缓存，下次仅重编译+重新 asar+打 deb，速度很快。')

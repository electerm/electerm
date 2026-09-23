#!/usr/bin/env node
/**
 * 测试打包脚本（一键本地测试打包）
 *
 * 一条命令完成：编译客户端 → 复制 src/app 到 work/app 并生成 package.json
 * （绕过 prepare.js 里的 yarn autoclean，本机无 yarn）→ 安装 work/app 生产依赖
 * → 重建原生模块（针对本地 electron 版本）→ 自增 test 标记 → electron-builder 打包 → 恢复配置。
 *
 * 关键设计（避免卡 splash screen）：
 *   绝不改动任何 package.json 的 version！因为运行时 basic.js / worker.js 等用
 *   packInfo.version 拼接资源路径（js/electerm-${version}.js、js/worker-${version}.js…），
 *   一旦 package.json 的 version 与 vite 编译产物文件名不一致就会加载失败、卡在启动页。
 *   本脚本只通过 electron-builder.json 的 artifactName 注入 test 标记，
 *   让产物文件名形如 electerm-5.0.6-test.N-linux-amd64.deb，运行时版本号保持原始值。
 *
 * 用法（最简：npm run btest 即可一键打包）：
 *   node build/bin/build-test.js            # 一键打包 linux deb（默认）
 *   node build/bin/build-test.js rpm        # 打包 linux rpm
 *   node build/bin/build-test.js tar.gz     # 打包 linux tar.gz
 *   node build/bin/build-test.js win        # 打包 win nsis
 *   node build/bin/build-test.js mac        # 打包 mac dmg
 */
const { cp, echo } = require('shelljs')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..')
const workApp = path.join(root, 'work', 'app')
const pkgPath = path.join(root, 'package.json')
const appPkgPath = path.join(workApp, 'package.json')
const ebSrc = path.join(root, 'build', 'electron-builder.json')
const ebDst = path.join(root, 'electron-builder.json')
const counterPath = path.join(root, '.test-build-num')

function readJson (p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
function writeJson (p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n')
}
function run (cmd, opts = {}) {
  echo(`\n[build-test] $ ${cmd}`)
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WORKFLOW_NAME: 'local' },
    ...opts
  })
}

// 1. 编译客户端（vite 输出到 work/app/assets，会清空并重建 assets 目录）
run('npm run compile')

// 2. prepare work/app：复制 src/app（app.js/pre.js 等核心文件）+ 生成 package.json
//    等价于 prepare.js 的前半段，但跳过其中依赖 yarn 的 autoclean（本机无 yarn）。
echo('[build-test] prepare work/app（复制 src/app，生成 package.json）')
if (!fs.existsSync(workApp)) {
  fs.mkdirSync(workApp, { recursive: true })
}
cp('-r', path.join(root, 'src', 'app'), workApp)
const pack = readJson(pkgPath)
pack.main = 'app.js'
delete pack.scripts
delete pack.standard
delete pack.files
delete pack.engines
delete pack.preferGlobal
writeJson(appPkgPath, pack)

// 3. 安装 work/app 生产依赖
echo('[build-test] 安装 work/app 生产依赖…')
run(`cd "${workApp}" && npm i --omit=dev --legacy-peer-deps --no-audit --no-fund`)

// 4. 重建原生模块（electron 版本升级后必须 rebuild node-pty/serialport）
echo('[build-test] 重建原生模块（node-pty/serialport）…')
run(`node node_modules/.bin/electron-rebuild -f -m "${workApp}"`)

// 5. 自增测试标记
let num = 0
if (fs.existsSync(counterPath)) {
  num = parseInt(fs.readFileSync(counterPath, 'utf8').trim(), 10) || 0
}
num += 1
fs.writeFileSync(counterPath, String(num))
const testTag = `test.${num}`

// 6. 准备 electron-builder.json：仅改 artifactName 注入 test 标记，不改任何 package.json
const eb = readJson(ebSrc)
eb.artifactName = `\${productName}-\${version}-${testTag}-\${os}-\${arch}.\${ext}`
writeJson(ebDst, eb)

// 7. 执行打包
const target = process.argv[2] || 'deb'
const platforms = {
  deb: '--linux deb',
  rpm: '--linux rpm',
  'tar.gz': '--linux tar.gz',
  snap: '--linux snap',
  win: '--win nsis',
  mac: '--mac dmg'
}
const targetArg = platforms[target] || '--linux deb'
try {
  echo(`\n[build-test] 测试标记: ${testTag}  打包目标: ${target}\n`)
  run(`node node_modules/.bin/electron-builder build ${targetArg} --publish never`)
} catch (e) {
  echo(`[build-test] 打包失败: ${e.message}`)
  process.exitCode = 1
} finally {
  // 8. 恢复 electron-builder.json 为原始（package.json 全程未改动，无需恢复）
  cp('-r', ebSrc, ebDst)
  echo('\n[build-test] 已恢复 electron-builder.json，package.json 未被修改\n')
}

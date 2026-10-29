/**
 * Per-launch isolation for the opt-in local WebGL lifecycle E2E.
 *
 * `--user-data-dir` only redirects Chromium's profile. electerm keeps its
 * config, connection history, widgets and the storage key somewhere else:
 * `src/app/lib/sqlite.js`, `src/app/lib/nedb.js` and
 * `src/app/lib/storage-key.js` all resolve
 * `process.env.DATA_PATH || resolve(app.getPath('appData'), 'electerm')`, and
 * `app.getPath('appData')` ignores `--user-data-dir` entirely. A run launched
 * with only the Chromium profile flag therefore writes `rendererType: 'webGL'`
 * into the developer's real config (updateConfig persists via saveUserConfig)
 * and adds its throwaway tabs to the real connection history -- and if the
 * worker dies before the spec's `finally`, they stay there.
 *
 * It is also one root per launch, not one per module load: both specs in
 * 004.webgl-lifecycle.spec.js run in the same Playwright worker, and a
 * profile/database still held by an app whose close failed would make the
 * second launch fail for a reason that looks like an app bug.
 *
 * 1. a fresh temp root, deleted only by cleanupWebglLaunchOptions() and only
 *    for roots this module created;
 * 2. DATA_PATH inside that root, so the app's own database lives there;
 * 3. a per-launch --user-data-dir inside that root;
 * 4. `allowMultiInstance` pre-seeded in the isolated config. The developer may
 *    already run electerm, and the default single-instance path would forward
 *    our launch to that app and quit. This changes the test's own throwaway
 *    config only -- the app's single-instance logic is untouched. With that
 *    forwarding out of the way, the inherited instance credentials
 *    (electermPort / electermHost / tokenElecterm) and the inherited session
 *    server environment (wsPort / type, which session-process.js would
 *    otherwise pass on to the session-server child) are dropped from the
 *    launch env so the app's own backend picks a free port, generates its own
 *    token and starts its session server on the port it allocated. That env
 *    cleanup is what the preflight verified; it is not a change to
 *    src/app/server/child-process.js or src/app/server/session-process.js.
 *
 * Everything else comes from ./app-options-webgl.js, which is itself
 * ./app-options.js minus --disable-gpu. Do not re-list launch arguments here:
 * the shared helper owns the entrypoint, NODE_TEST, the Linux sandbox flags
 * and the explicit ELECTERM_E2E_NO_SANDBOX opt-out.
 */
const { mkdtempSync, mkdirSync, rmSync, existsSync } = require('fs')
const { DatabaseSync } = require('node:sqlite')
const { tmpdir } = require('os')
const { dirname, join, resolve } = require('path')
const base = require('./app-options-webgl')
const { userNoEncryptConfigId } = require('../../../app/common/constants')
const defaultUserName = require('../../../app/common/default-user-name')

const ROOT_PREFIX = 'electerm-webgl-e2e-'
const ownedRoots = new Set()

// 后端子进程的启动环境由 child-process.js / session-process.js 决定，必须由它们
// 自己生成；从父环境继承来的实例凭据与旧会话端口会让测试连到别人的服务或绑定
// 到上一次会话的端口。
//   - electermPort / electermHost / tokenElecterm：child-process.js 以
//     Object.assign(默认值, cleanEnv) 组装 server 子进程，继承值会压过它选好的端口。
//   - wsPort / type：session-process.js:41-52 以
//     Object.assign({ wsPort: port, type }, cleanEnv) 组装 session-server 子进程，
//     cleanEnv 在后；session-server.js 直接读 process.env.wsPort/type 并 listen。
//     父环境残留的旧会话端口会让新会话绑定旧端口，与前端预期端口不一致。
const INHERITED_INSTANCE_ENV_KEYS = [
  'electermPort',
  'electermHost',
  'tokenElecterm',
  'wsPort',
  'type'
]

/**
 * Seed the isolated database with the app's own no-encrypt config row.
 *
 * Same shape src/app/lib/sqlite.js creates: the `data` table lives in
 * electerm_data.db, and `allowMultiInstance` is one of the
 * configNoEncryptFields from src/app/lib/user-config-controller.js.
 */
function seedIsolatedData (dataPath) {
  const dbFolder = join(dataPath, 'users', defaultUserName)
  mkdirSync(dbFolder, { recursive: true })
  const db = new DatabaseSync(join(dbFolder, 'electerm_data.db'))
  try {
    db.exec('CREATE TABLE IF NOT EXISTS data (_id TEXT PRIMARY KEY, data TEXT)')
    db
      .prepare('INSERT OR REPLACE INTO data (_id, data) VALUES (?, ?)')
      .run(userNoEncryptConfigId, JSON.stringify({ allowMultiInstance: true }))
  } finally {
    db.close()
  }
}

/**
 * Launch options for one Electron launch.
 *
 * @returns {{ env: object, args: string[] }} a fresh, independent options
 *   object; the shared base is never mutated.
 */
function createWebglLaunchOptions () {
  const root = mkdtempSync(join(tmpdir(), ROOT_PREFIX))
  ownedRoots.add(root)
  const dataPath = join(root, 'data')
  const profilePath = join(root, 'profile')
  mkdirSync(profilePath, { recursive: true })
  seedIsolatedData(dataPath)

  // 父进程可能正运行 electerm（或从它继承环境），从而导出下面这些变量。
  // 后端由 src/app/server/child-process.js 与 session-process.js 以
  // Object.assign(默认值, cleanEnv) 组装环境，父 env 里的值会压过它们自己选好的
  // 端口、token 和会话类型：测试会去连开发者实例的 127.0.0.1:30975（EADDRINUSE）、
  // 用错 token 导致前端鉴权失败，或让 session-server 仍绑定上一次会话的 wsPort。
  // 只删除本次 launch 的 env 副本，base.env 保持原样（其他测试/E2E 不受影响）。
  const env = {
    ...base.env,
    // Overrides any DATA_PATH inherited from the developer's shell, which
    // would otherwise point the app straight back at their real data.
    DATA_PATH: dataPath
  }
  for (const key of INHERITED_INSTANCE_ENV_KEYS) {
    delete env[key]
  }

  return {
    env,
    args: [
      ...base.args.filter(arg => !arg.startsWith('--user-data-dir=')),
      `--user-data-dir=${profilePath}`
    ]
  }
}

/**
 * Remove the temp root created for `options`.
 *
 * Call this only after the app that used the root has exited: the profile and
 * database belong to it while it runs. Returns false when there is nothing to
 * remove -- unknown options, a directory this module did not create, a second
 * call for the same root, or a removal the filesystem refused. A false return
 * means the developer's data was not touched.
 *
 * A `electron.launch()` that throws leaves its root behind on purpose: launch
 * can fail after the app process has started, and deleting a profile a live app
 * still has open is worse than a stray directory under the OS temp dir.
 *
 * @param {{ env?: { DATA_PATH?: string } }} options
 * @returns {boolean} true when this call removed a root it owned
 */
function cleanupWebglLaunchOptions (options) {
  const dataPath = options?.env?.DATA_PATH
  if (typeof dataPath !== 'string' || !dataPath) {
    return false
  }
  const root = dirname(resolve(dataPath))
  if (!ownedRoots.has(root)) {
    return false
  }
  ownedRoots.delete(root)
  if (!existsSync(root)) {
    return true
  }
  try {
    rmSync(root, { recursive: true, force: true, maxRetries: 2 })
  } catch (_) {
    return false
  }
  return !existsSync(root)
}

module.exports = {
  ROOT_PREFIX,
  createWebglLaunchOptions,
  cleanupWebglLaunchOptions
}

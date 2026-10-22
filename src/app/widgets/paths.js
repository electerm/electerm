/**
 * Where user-installed widgets live: <data dir>/widgets/<id>/.
 *
 * The data dir is the same one the db uses (see lib/db.js): DATA_PATH wins,
 * else appData/electerm. Resolved lazily and defensively, because these modules
 * are also required from unit tests where electron is not loaded.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const WIDGETS_DIR_NAME = 'widgets'
const WIDGET_ID_PATTERN = /^[a-z0-9-]+$/

function getDataDir () {
  if (process.env.DATA_PATH) {
    return process.env.DATA_PATH
  }
  try {
    const { appPath } = require('../common/app-props')
    return path.join(appPath, 'electerm')
  } catch (e) {
    return path.join(os.tmpdir(), 'electerm')
  }
}

function getUserWidgetDir () {
  return path.join(getDataDir(), WIDGETS_DIR_NAME)
}

function ensureUserWidgetDir () {
  const dir = getUserWidgetDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// The id is used as a folder name in three places (listing, running, the
// custom protocol), so it is validated the same way everywhere.
function isValidWidgetId (id) {
  return typeof id === 'string' && WIDGET_ID_PATTERN.test(id)
}

// Absolute folder of one user widget, guaranteed to sit directly under the
// widgets root.
function resolveUserWidgetDir (id) {
  if (!isValidWidgetId(id)) {
    throw new Error(`Invalid widget ID: ${id}`)
  }
  const root = getUserWidgetDir()
  const dir = path.resolve(root, id)
  if (path.dirname(dir) !== path.resolve(root)) {
    throw new Error(`Invalid widget ID: ${id}`)
  }
  return dir
}

// Is `target` inside `root` (and not root itself)? Used for every path that
// comes out of a manifest, so `../..` in package.json cannot escape the widget.
function isInside (root, target) {
  const rel = path.relative(root, target)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

module.exports = {
  WIDGETS_DIR_NAME,
  getDataDir,
  getUserWidgetDir,
  ensureUserWidgetDir,
  isValidWidgetId,
  resolveUserWidgetDir,
  isInside
}

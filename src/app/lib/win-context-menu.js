/**
 * Windows Explorer context menu integration
 * Registers/unregisters "Open in electerm" in the Explorer context menu
 * for folders and folder backgrounds (right-click inside a folder).
 *
 * Uses HKCU so no elevation / UAC is required.
 */

const { spawnSync } = require('child_process')
const { app } = require('electron')
const log = require('../common/log')

const REG_DIR_KEY = 'HKCU\\Software\\Classes\\Directory\\shell\\electerm'
const REG_BG_KEY = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\electerm'
const MENU_LABEL = 'Open in electerm'

function getExePath () {
  return app.getPath('exe')
}

/**
 * Run `reg` with the given arguments (no shell, so no escaping issues).
 * @param {string[]} args
 * @returns {{ ok: boolean, stderr: string }}
 */
function runReg (args) {
  const result = spawnSync('reg', args, { encoding: 'utf8' })
  return { ok: result.status === 0, stderr: result.stderr || '' }
}

/**
 * Write a REG_SZ value.  Pass valueName='' for the default (unnamed) value.
 */
function regWrite (key, valueName, data) {
  const args = ['add', key]
  if (valueName === '') {
    args.push('/ve') // default value
  } else {
    args.push('/v', valueName)
  }
  args.push('/t', 'REG_SZ', '/d', data, '/f')
  const { ok, stderr } = runReg(args)
  if (!ok) {
    throw new Error(`reg add "${key}" failed: ${stderr}`)
  }
}

/**
 * Check whether a registry key exists.
 * @param {string} key
 * @returns {boolean}
 */
function regExists (key) {
  const { ok } = runReg(['query', key, '/ve'])
  return ok
}

/**
 * Delete a registry key and all its sub-keys.
 * @param {string} key
 */
function regDelete (key) {
  runReg(['delete', key, '/f'])
}

// ---------------------------------------------------------------------------

/**
 * Register "Open in electerm" in Windows Explorer context menu.
 * @returns {{ registered: boolean, error?: string }}
 */
function registerContextMenu () {
  try {
    const exe = getExePath()

    // Right-click on a folder icon
    regWrite(REG_DIR_KEY, '', MENU_LABEL)
    regWrite(REG_DIR_KEY, 'Icon', exe)
    regWrite(`${REG_DIR_KEY}\\command`, '', `"${exe}" -tp "local" -d "%1"`)

    // Right-click inside a folder (background)
    regWrite(REG_BG_KEY, '', MENU_LABEL)
    regWrite(REG_BG_KEY, 'Icon', exe)
    regWrite(`${REG_BG_KEY}\\command`, '', `"${exe}" -tp "local" -d "%V"`)

    log.info('Windows context menu registered')
    return { registered: true }
  } catch (err) {
    log.error('Failed to register Windows context menu:', err)
    return { registered: false, error: err.message }
  }
}

/**
 * Unregister "Open in electerm" from Windows Explorer context menu.
 * @returns {{ unregistered: boolean, error?: string }}
 */
function unregisterContextMenu () {
  try {
    regDelete(REG_DIR_KEY)
    regDelete(REG_BG_KEY)
    log.info('Windows context menu unregistered')
    return { unregistered: true }
  } catch (err) {
    log.error('Failed to unregister Windows context menu:', err)
    return { unregistered: false, error: err.message }
  }
}

/**
 * Check whether the context menu entries are currently registered.
 * @returns {boolean}
 */
function checkContextMenuStatus () {
  return regExists(REG_DIR_KEY)
}

module.exports = {
  registerContextMenu,
  unregisterContextMenu,
  checkContextMenuStatus
}

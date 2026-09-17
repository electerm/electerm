/**
 * brand new install seed data: default local terminal bookmarks and
 * default quick commands (src/app/upgrade/db-defaults.js)
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const defaults = require('../../app/upgrade/db-defaults')
const {
  buildWindowsBookmarks,
  buildPosixBookmark,
  posixShells
} = require('../../app/upgrade/default-local-bookmarks')
const {
  macOsCommands,
  linuxCommands,
  windowsCommands,
  getDefaultCmdHistory
} = require('../../app/upgrade/default-quick-commands')
const fs = require('node:fs')
const path = require('node:path')

const clientDir = path.resolve(__dirname, '../../client')

const isWin = process.platform.startsWith('win')
const isMac = process.platform === 'darwin'
const execProp = isWin ? 'execWindows' : isMac ? 'execMac' : 'execLinux'
const execArgsProp = isWin ? 'execWindowsArgs' : isMac ? 'execMacArgs' : 'execLinuxArgs'

function entry (db) {
  return defaults.find(d => d && d.db === db)
}

describe('db-defaults shape', () => {
  it('keeps terminalThemes first: v1.7.0 migration reads data[0] / data[1]', () => {
    assert.equal(defaults[0].db, 'terminalThemes')
    assert.equal(defaults[0].data[0]._id, 'default')
    assert.equal(defaults[0].data[1]._id, 'defaultLight')
  })

  it('seeds bookmarks, bookmarkGroups and quickCommands', () => {
    for (const db of ['bookmarks', 'bookmarkGroups', 'quickCommands']) {
      const e = entry(db)
      assert.ok(e, `${db} entry missing`)
      assert.ok(Array.isArray(e.data), `${db} data should be an array`)
      assert.ok(e.data.length > 0, `${db} data should not be empty`)
    }
  })

  it('seeds the terminal command history too', () => {
    const e = entry('terminalCommandHistory')
    assert.ok(e, 'terminalCommandHistory entry missing')
    assert.ok(e.data.length > 0)
  })

  it('every db name is a real table', () => {
    // mirrors the table list of app/lib/sqlite.js and app/lib/nedb.js
    const known = [
      'bookmarks', 'bookmarkGroups', 'addressBookmarks', 'terminalThemes',
      'lastStates', 'data', 'quickCommands', 'log', 'dbUpgradeLog', 'profiles',
      'workspaces', 'triggers', 'history', 'terminalCommandHistory',
      'aiChatHistory', 'autoRunWidgets'
    ]
    for (const e of defaults) {
      assert.ok(known.includes(e.db), `${e.db} is not a db table`)
    }
  })
})

describe('default local terminal bookmarks', () => {
  const bookmarks = entry('bookmarks').data

  it('all use fixed, unique ids', () => {
    const ids = bookmarks.map(b => b._id)
    assert.equal(new Set(ids).size, ids.length)
    for (const id of ids) {
      assert.match(id, /^default-local-/)
      // 'new-bookmark' prefix marks an unsaved form item
      assert.equal(id.startsWith('new-bookmark'), false)
    }
  })

  it('are local bookmarks carrying the current platform exec field', () => {
    for (const b of bookmarks) {
      assert.equal(b.type, 'local')
      assert.ok(b.title)
      assert.ok(b.description)
      assert.ok(b.color)
      assert.ok(b[execProp], `${b.title} missing ${execProp}`)
      assert.deepEqual(b[execArgsProp], [])
    }
  })

  it('never leaks another platform exec field', () => {
    const others = ['execWindows', 'execMac', 'execLinux'].filter(k => k !== execProp)
    for (const b of bookmarks) {
      for (const k of others) {
        assert.equal(b[k], undefined, `${b.title} should not set ${k}`)
      }
    }
  })

  it('the default group lists exactly the seeded bookmarks', () => {
    const group = entry('bookmarkGroups').data.find(g => g._id === 'default')
    assert.ok(group)
    assert.deepEqual(
      [...group.bookmarkIds].sort(),
      bookmarks.map(b => b._id).sort()
    )
  })

  it('windows builder only keeps installed shells', () => {
    const full = buildWindowsBookmarks({
      cmd: 'System32/cmd.exe',
      powershell: 'System32/WindowsPowerShell/v1.0/powershell.exe',
      pwsh: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      wsl: 'System32/wsl.exe',
      gitBash: 'C:\\Program Files\\Git\\bin\\bash.exe'
    })
    assert.deepEqual(
      full.map(b => b._id),
      [
        'default-local-cmd',
        'default-local-powershell',
        'default-local-pwsh',
        'default-local-wsl',
        'default-local-git-bash'
      ]
    )
    for (const b of full) {
      assert.equal(b.type, 'local')
      assert.equal(b.execWindowsArgs.length, 0)
      assert.ok(b.execWindows)
    }

    // a machine without git bash / pwsh simply gets fewer entries
    const partial = buildWindowsBookmarks({
      cmd: 'System32/cmd.exe',
      powershell: '',
      pwsh: '',
      wsl: '',
      gitBash: ''
    })
    assert.deepEqual(partial.map(b => b._id), ['default-local-cmd'])

    assert.deepEqual(buildWindowsBookmarks({}), [])
  })

  it('windows exec values survive path.resolve against windir', () => {
    const { resolve } = require('path').win32
    const windir = 'C:\\Windows'
    const full = buildWindowsBookmarks({
      cmd: 'System32/cmd.exe',
      powershell: 'System32/WindowsPowerShell/v1.0/powershell.exe',
      pwsh: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      wsl: 'System32/wsl.exe',
      gitBash: ''
    })
    const resolved = full.map(b => resolve(windir, b.execWindows))
    assert.deepEqual(resolved, [
      'C:\\Windows\\System32\\cmd.exe',
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      'C:\\Windows\\System32\\wsl.exe'
    ])
    // session-local.js rejects exec values containing '..'
    for (const r of resolved) {
      assert.equal(r.includes('..'), false)
    }
  })

  it('posix builder sets the matching platform field', () => {
    const b = buildPosixBookmark('zsh', 'execMac', 'execMacArgs', 'zsh')
    assert.equal(b._id, 'default-local-zsh')
    assert.equal(b.execMac, 'zsh')
    assert.deepEqual(b.execMacArgs, [])
    assert.equal(b.execWindows, undefined)
    assert.ok(posixShells.includes('zsh'))
    assert.ok(posixShells.includes('bash'))
  })
})

describe('default quick commands', () => {
  const quickCommands = entry('quickCommands').data

  it('all use fixed, unique ids', () => {
    const ids = quickCommands.map(q => q._id)
    assert.equal(new Set(ids).size, ids.length)
    for (const id of ids) {
      assert.match(id, /^default-qm-/)
    }
  })

  it('match the shape the quick command form saves', () => {
    for (const q of quickCommands) {
      assert.ok(q.name, 'name required')
      assert.ok(q.name.length <= 60, 'name is limited to 60 chars in the form')
      assert.equal(typeof q.inputOnly, 'boolean')
      assert.deepEqual(q.shortcut, '')
      assert.ok(Array.isArray(q.labels))
      assert.ok(Array.isArray(q.commands))
      assert.ok(q.commands.length > 0)
      for (const c of q.commands) {
        assert.ok(c.id)
        assert.ok(c.command)
        assert.equal(typeof c.delay, 'number')
      }
    }
  })

  it('never contains a quick command template placeholder', () => {
    // store/quick-command.js rewrites {{clipboard}} / {{time}} / {{date}}
    for (const list of [macOsCommands, linuxCommands, windowsCommands]) {
      for (const q of list) {
        for (const c of q.commands) {
          assert.equal(c.command.includes('{{'), false, `${q.name}: ${c.command}`)
        }
      }
    }
  })

  it('offers system / disk / network checks on every platform', () => {
    for (const list of [macOsCommands, linuxCommands, windowsCommands]) {
      const names = list.map(q => q.name)
      for (const expected of ['ls', 'sysinfo', 'ping']) {
        assert.ok(names.includes(expected), `missing ${expected}`)
      }
      const labels = new Set(list.flatMap(q => q.labels))
      for (const l of ['system', 'disk', 'network']) {
        assert.ok(labels.has(l), `missing label ${l}`)
      }
    }
  })

  it('uses the platform shell syntax', () => {
    const winNames = windowsCommands.map(q => q.name)
    assert.ok(winNames.includes('disk'))
    assert.equal(winNames.includes('df'), false)
    for (const q of windowsCommands) {
      // PowerShell only: no POSIX pipeline helpers
      assert.equal(/\bls -|&&|\bdf -h\b/.test(q.commands[0].command), false)
    }

    for (const list of [macOsCommands, linuxCommands]) {
      const names = list.map(q => q.name)
      assert.ok(names.includes('df'))
      assert.equal(names.includes('disk'), false)
    }
    assert.ok(macOsCommands.find(q => q.name === 'sysinfo').commands[0].command.includes('sw_vers'))
    assert.ok(linuxCommands.find(q => q.name === 'sysinfo').commands[0].command.includes('/etc/os-release'))
  })
})

describe('default terminal command history', () => {
  const history = entry('terminalCommandHistory').data
  const quickCommands = entry('quickCommands').data

  it('mirrors the default quick commands', () => {
    assert.deepEqual(
      history.map(h => h.cmd).sort(),
      quickCommands.flatMap(q => q.commands.map(c => c.command)).sort()
    )
  })

  it('matches the shape addCmdHistory writes', () => {
    for (const h of history) {
      assert.ok(h._id)
      assert.ok(h.cmd)
      assert.equal(typeof h.count, 'number')
      assert.ok(h.count > 0, 'a zero count renders as an empty looking badge')
      assert.equal(new Date(h.lastUseTime).toISOString(), h.lastUseTime)
    }
  })

  it('has unique ids and unique commands', () => {
    assert.equal(new Set(history.map(h => h._id)).size, history.length)
    assert.equal(new Set(history.map(h => h.cmd)).size, history.length)
  })

  it('is stored backwards so the popover shows ls first', () => {
    // components/footer/cmd-history.jsx renders the array reversed, newest first
    const shown = history.slice().reverse().map(h => h.cmd)
    assert.equal(shown[0], 'ls -alh')
    assert.equal(history[history.length - 1].cmd, 'ls -alh')
  })

  it('is derived, not hand written', () => {
    const fresh = getDefaultCmdHistory()
    assert.deepEqual(
      fresh.map(({ lastUseTime, ...rest }) => rest),
      history.map(({ lastUseTime, ...rest }) => rest)
    )
  })
})

describe('built in seed items stay deletable', () => {
  const listSrc = fs.readFileSync(
    path.join(clientDir, 'components/setting-panel/list.jsx'),
    'utf8'
  )
  const constantsSrc = fs.readFileSync(
    path.join(clientDir, 'common/constants.js'),
    'utf8'
  )

  it('the delete button is no longer hidden by a "default" id prefix', () => {
    assert.doesNotMatch(
      listSrc,
      /startsWith\('default'\)/,
      'a prefix test also hides delete for default quick commands/bookmarks'
    )
    assert.match(listSrc, /undeletableIds\.has\(item\.id\)/)
  })

  it('still protects the real built in items', () => {
    assert.match(constantsSrc, /export const undeletableIds = new Set\(\[/)
    for (const id of [
      'settingSyncId',
      'settingCommonId',
      'defaultBookmarkGroupId',
      'defaultThemeId',
      'defaultThemeLightId'
    ]) {
      assert.ok(constantsSrc.includes(id), `${id} should be undeletable`)
    }
  })

  it('seeded ids never collide with the undeletable ones', () => {
    // 'default' is both the default bookmark group and the default theme id
    const protectedIds = new Set([
      'setting-sync',
      'setting-common',
      'default',
      'defaultLight'
    ])
    const seededIds = [
      ...entry('quickCommands').data.map(q => q._id),
      ...entry('bookmarks').data.map(b => b._id)
    ]
    assert.ok(seededIds.length > 0)
    for (const id of seededIds) {
      assert.equal(protectedIds.has(id), false, `${id} would be undeletable`)
    }
  })
})

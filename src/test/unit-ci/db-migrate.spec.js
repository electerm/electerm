process.env.NODE_ENV = 'development'

const { describe, test, before } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

// Isolate NeDB files created by migrate scripts into a temp dir
const tmpDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-migrate-test-'))
process.env.DATA_PATH = tmpDataPath

// Stub electron + electron-log so app-side migrate modules load in plain node
const electronStub = {
  app: {
    getPath: (name) => {
      if (name === 'home') {
        return os.homedir()
      }
      return tmpDataPath
    }
  }
}
const electronLogStub = {
  transports: {
    console: {},
    file: {}
  },
  info: () => {},
  error: () => {},
  warn: () => {},
  log: () => {},
  debug: () => {}
}
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return electronStub
  }
  if (request === 'electron-log') {
    return electronLogStub
  }
  return originalLoad.call(this, request, parent, isMain)
}

const migrateDir = path.resolve(__dirname, '../../app/migrate')
const upgradeDir = path.resolve(__dirname, '../../app/upgrade')

describe('migrate v1.7.0 db-defaults require (regression)', () => {
  test('v1.7.0.js loads: no more Cannot find module ./db-defaults', () => {
    assert.doesNotThrow(() => {
      require('../../app/migrate/v1.7.0')
    })
  })

  test('v1.7.0.js requires the real ../upgrade/db-defaults module', () => {
    const src = fs.readFileSync(path.join(migrateDir, 'v1.7.0.js'), 'utf8')
    assert.match(src, /require\(['"]\.\.\/upgrade\/db-defaults['"]\)/)
    assert.doesNotMatch(src, /require\(['"]\.\/db-defaults['"]\)/)
  })

  test('there is no migrate/db-defaults.js: the old relative path could never resolve', () => {
    assert.equal(fs.existsSync(path.join(migrateDir, 'db-defaults.js')), false)
    assert.equal(fs.existsSync(path.join(migrateDir, 'db-defaults.json')), false)
  })

  test('../upgrade/db-defaults exposes terminalThemes default + defaultLight', () => {
    const defaults = require('../../app/upgrade/db-defaults')
    assert.ok(Array.isArray(defaults))
    const themes = defaults.find(d => d && d.db === 'terminalThemes')
    assert.ok(themes)
    assert.equal(themes.data[0]._id, 'default')
    assert.equal(themes.data[1]._id, 'defaultLight')
    assert.ok(themes.data[0].uiThemeConfig)
    assert.ok(themes.data[1].uiThemeConfig)
  })
})

describe('migrate/upgrade version file parsing', () => {
  let migrateIndex
  let upgradeIndex
  let compare

  before(() => {
    migrateIndex = require('../../app/migrate/index')
    upgradeIndex = require('../../app/upgrade/index')
    compare = require('../../app/common/version-compare')
  })

  test('both index modules export parseUpgradeFile', () => {
    assert.equal(typeof migrateIndex.parseUpgradeFile, 'function')
    assert.equal(typeof upgradeIndex.parseUpgradeFile, 'function')
  })

  test('parses vX.Y.Z.js filenames to versions', () => {
    for (const parse of [migrateIndex.parseUpgradeFile, upgradeIndex.parseUpgradeFile]) {
      assert.equal(parse('v1.7.0.js'), '1.7.0')
      assert.equal(parse('v1.34.59.js'), '1.34.59')
      assert.equal(parse('v1.3.0.js'), '1.3.0')
    }
  })

  test('rejects non-version helper files living in the same dir', () => {
    const nonVersions = [
      'index.js',
      'migrate-1-to-2.js',
      'nedb-instance.js',
      'version-upgrade.js',
      'db-defaults.js',
      'v1.7.0',
      'v1.7.0.json',
      '.DS_Store'
    ]
    for (const parse of [migrateIndex.parseUpgradeFile, upgradeIndex.parseUpgradeFile]) {
      for (const f of nonVersions) {
        assert.equal(parse(f), null, `${f} should not parse as a version`)
      }
    }
  })

  test('every v*.js file in migrate/ parses (no silently skipped migrations)', () => {
    const files = fs.readdirSync(migrateDir).filter(f => /^v\d/.test(f))
    assert.ok(files.length > 0)
    for (const f of files) {
      assert.ok(migrateIndex.parseUpgradeFile(f), `${f} should parse as a version`)
    }
  })

  test('sorting uses parsed versions, so 1.25.0 sorts after 1.7.0', () => {
    const files = ['v1.25.0.js', 'v1.7.0.js', 'v1.3.9.js']
    const sorted = [...files].sort((a, b) => compare(
      migrateIndex.parseUpgradeFile(a),
      migrateIndex.parseUpgradeFile(b)
    ))
    assert.deepEqual(sorted, ['v1.3.9.js', 'v1.7.0.js', 'v1.25.0.js'])
  })

  test('strict parsing rejects backup/decoy files the old loose filter could pick up', () => {
    // old code: f.replace('.js', '').replace('v', '') + /^v\d/ would accept
    // 'v1.7.0.js.bak' as a migration and then require() it
    for (const parse of [migrateIndex.parseUpgradeFile, upgradeIndex.parseUpgradeFile]) {
      assert.equal(parse('v1.7.0.js.bak'), null)
      assert.equal(parse('v1.7.0.backup.js'), null)
    }
  })
})

describe('upgrade resilience: one broken script must not brick startup', () => {
  test('migrate/index.js isolates per-script failures and stamps version', () => {
    const src = fs.readFileSync(path.join(migrateDir, 'index.js'), 'utf8')
    assert.match(src, /try\s*\{[\s\S]*?require\(p\)[\s\S]*?catch/)
    assert.match(src, /Upgrade script .* fails, skip it/)
    assert.match(src, /await updateDBVersion\(vv\)/)
  })

  test('upgrade/index.js has the same per-script isolation', () => {
    const src = fs.readFileSync(path.join(upgradeDir, 'index.js'), 'utf8')
    assert.match(src, /try\s*\{[\s\S]*?require\(p\)[\s\S]*?catch/)
    assert.match(src, /await updateDBVersion\(vv\)/)
  })

  test('migrate-1-to-2.js pre-migration upgrade failure does not abort migration', () => {
    const src = fs.readFileSync(path.join(migrateDir, 'migrate-1-to-2.js'), 'utf8')
    assert.match(src, /Pre-migration db upgrade fails, continue migrating anyway/)
  })
})

describe('v1.7.0 migration functional (tmp NeDB)', () => {
  test('updates uiThemeConfig and inserts defaultLight idempotently', async () => {
    const { dbAction } = require('../../app/migrate/nedb-instance')
    const runV170 = require('../../app/migrate/v1.7.0')
    const defaults = require('../../app/upgrade/db-defaults')
    const expectedUi = defaults[0].data[0].uiThemeConfig

    await dbAction('terminalThemes', 'insert', {
      _id: 'default',
      name: 'default',
      themeConfig: {},
      uiThemeConfig: {}
    }).catch(() => {})
    await dbAction('terminalThemes', 'insert', {
      _id: 'custom1',
      name: 'custom1',
      themeConfig: {},
      uiThemeConfig: {}
    }).catch(() => {})

    await runV170()
    // second run must be safe (no duplicate-key crash, keeps working)
    await runV170()

    const def = await dbAction('terminalThemes', 'findOne', { _id: 'default' })
    assert.deepEqual(def.uiThemeConfig, expectedUi)

    const custom = await dbAction('terminalThemes', 'findOne', { _id: 'custom1' })
    assert.deepEqual(custom.uiThemeConfig, expectedUi)

    const light = await dbAction('terminalThemes', 'findOne', { _id: 'defaultLight' })
    assert.ok(light)
    assert.equal(light._id, 'defaultLight')

    const version = await dbAction('data', 'findOne', { _id: 'version' })
    assert.equal(version.value, '1.7.0')
  })
})

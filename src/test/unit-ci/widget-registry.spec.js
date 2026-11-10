/**
 * Registry installs: a pinned commit plus a hash for every file. The download
 * is faked here, so what is under test is the validation and the rule that a
 * tree which does not match the record is never installed.
 */
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  computeDigest,
  validateRegistryRecord,
  collectTree,
  verifyWidgetTree,
  registrySource,
  importWidgetFromRegistry
} = require('../../app/widgets/widget-registry')

const sha = 'a'.repeat(40)
const pkg = JSON.stringify({
  name: 'demo-widget',
  version: '1.0.0',
  main: 'index.js',
  electerm: { id: 'demo-widget', name: 'Demo', type: 'once' }
})

let tmp
let n = 0

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-widget-registry-'))
})

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function writeWidget (files) {
  const dir = path.join(tmp, `widget-${n++}`)
  fs.mkdirSync(dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return dir
}

// Independent of collectTree(), so a bug in the walk cannot hide itself.
function hashTree (dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name)
    const stat = fs.lstatSync(file)
    if (stat.isDirectory()) {
      // The site's build script excludes .git, so records never list it.
      if (name !== '.git') {
        hashTree(file, base, out)
      }
      continue
    }
    const data = fs.readFileSync(file)
    out.push({
      path: path.relative(base, file).split(path.sep).join('/'),
      size: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex')
    })
  }
  return out
}

function recordFor (dir, extra = {}) {
  const files = hashTree(dir)
  return {
    id: 'demo-widget',
    host: 'github.com',
    owner: 'electerm',
    repo: 'demo-widget',
    subdir: '',
    ref: sha,
    version: '1.0.0',
    name: 'Demo',
    description: 'a demo widget',
    author: 'me',
    license: 'MIT',
    homepage: '',
    sourceUrl: '',
    status: 'public',
    filesUrl: '/api/v1/widgets/demo-widget.json',
    fileCount: files.length,
    totalSize: files.reduce((sum, file) => sum + file.size, 0),
    digest: computeDigest(files),
    files,
    ...extra
  }
}

const baseFiles = () => ({
  'package.json': pkg,
  'index.js': 'module.exports = {}\n',
  'lib/helper.js': 'module.exports = 1\n',
  '.gitignore': 'node_modules/\n'
})

describe('registry digest', () => {
  it('matches the site build script byte for byte', () => {
    const sample = [
      { path: 'src/main.js', size: 10, sha256: 'a'.repeat(64) },
      { path: 'package.json', size: 3, sha256: 'b'.repeat(64) },
      { path: 'README.md', size: 7, sha256: 'c'.repeat(64) }
    ]
    assert.equal(
      computeDigest(sample),
      'sha256:e8af97d205579895a5bbf25562868d8b9e05eb0f98c0ee0182be3ff374d218b4'
    )
    assert.equal(computeDigest(sample), computeDigest([...sample].reverse()))
  })
})

describe('registry record validation', () => {
  it('accepts a complete record', () => {
    const record = recordFor(writeWidget(baseFiles()))
    assert.equal(validateRegistryRecord(record).id, 'demo-widget')
  })

  it('refuses a branch, a mismatched digest and a bad host', () => {
    const record = recordFor(writeWidget(baseFiles()))
    assert.throws(() => validateRegistryRecord({ ...record, ref: 'main' }), /40 character commit sha/)
    assert.throws(() => validateRegistryRecord({ ...record, digest: 'sha256:' + '0'.repeat(64) }), /digest does not match/)
    assert.throws(() => validateRegistryRecord({ ...record, host: 'evil.example.com' }), /host is not supported/)
    assert.throws(() => validateRegistryRecord({ ...record, id: '../escape' }), /id is not usable/)
  })

  it('refuses unsafe file paths and a lying count', () => {
    const record = recordFor(writeWidget(baseFiles()))
    assert.throws(
      () => validateRegistryRecord({ ...record, files: [{ ...record.files[0], path: '../escape' }] }),
      /file path is not usable/
    )
    assert.throws(
      () => validateRegistryRecord({ ...record, fileCount: 999 }),
      /file count or total size/
    )
  })
})

describe('downloaded tree verification', () => {
  it('hashes hidden files and files in node_modules', () => {
    const dir = writeWidget({
      ...baseFiles(),
      'node_modules/@scope/pkg/index.js': 'module.exports = 2\n'
    })
    const paths = collectTree(dir).map(file => file.path).sort()
    assert.ok(paths.includes('.gitignore'))
    assert.ok(paths.includes('node_modules/@scope/pkg/index.js'))
    assert.doesNotThrow(() => verifyWidgetTree(dir, recordFor(dir)))
  })

  it('ignores a .git folder, as the archive filter does', () => {
    const dir = writeWidget({ ...baseFiles(), '.git/config': 'nope\n' })
    assert.equal(collectTree(dir).some(file => file.path.startsWith('.git/')), false)
    assert.doesNotThrow(() => verifyWidgetTree(dir, recordFor(dir)))
  })

  it('refuses a changed file, an extra file and a symlink', () => {
    const dir = writeWidget(baseFiles())
    const record = recordFor(dir)
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = { evil: true }\n')
    assert.throws(() => verifyWidgetTree(dir, record), /does not match the registry record/)

    const dir2 = writeWidget(baseFiles())
    const record2 = recordFor(dir2)
    fs.writeFileSync(path.join(dir2, 'extra.js'), 'extra\n')
    assert.throws(() => verifyWidgetTree(dir2, record2), /not listed in the registry record/)

    const dir3 = writeWidget(baseFiles())
    const record3 = recordFor(dir3)
    fs.symlinkSync('/etc/passwd', path.join(dir3, 'link'))
    assert.throws(() => verifyWidgetTree(dir3, record3), /link or special file/)
  })

  it('refuses a folder whose manifest names another widget', () => {
    const dir = writeWidget({
      ...baseFiles(),
      'package.json': JSON.stringify({ name: 'other', electerm: { id: 'other' } })
    })
    assert.throws(() => verifyWidgetTree(dir, recordFor(dir)), /does not match the registry record/)
  })
})

describe('registry install', () => {
  it('pins the commit in the download URL', () => {
    const record = recordFor(writeWidget(baseFiles()))
    assert.equal(
      registrySource(record),
      `https://github.com/electerm/demo-widget/tree/${sha}`
    )
    assert.equal(
      registrySource({ ...record, host: 'atomgit.com', subdir: 'widgets/foo' }),
      `https://atomgit.com/electerm/demo-widget/tree/${sha}/widgets/foo`
    )
  })

  it('installs only after the tree matches, and always cleans up', async () => {
    const dir = writeWidget(baseFiles())
    const record = recordFor(dir)
    let cleaned = false
    let installed = null
    const result = await importWidgetFromRegistry(record, false, {
      fetchSource: async (input) => {
        assert.match(input, /\/tree\/a{40}$/)
        return { dir, cleanup: () => { cleaned = true } }
      },
      install: (srcDir, overwrite) => {
        installed = { srcDir, overwrite }
        return { id: record.id, success: true }
      }
    })
    assert.equal(installed.srcDir, dir)
    assert.equal(installed.overwrite, false)
    assert.equal(result.registryId, 'demo-widget')
    assert.equal(cleaned, true)
  })

  it('never installs a tampered tree', async () => {
    const dir = writeWidget(baseFiles())
    const record = recordFor(dir)
    fs.writeFileSync(path.join(dir, 'index.js'), 'tampered\n')
    let installed = false
    let cleaned = false
    await assert.rejects(
      importWidgetFromRegistry(record, false, {
        fetchSource: async () => ({ dir, cleanup: () => { cleaned = true } }),
        install: () => { installed = true }
      }),
      /does not match the registry record/
    )
    assert.equal(installed, false)
    assert.equal(cleaned, true)
  })
})

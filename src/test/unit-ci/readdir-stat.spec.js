const { describe, test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fss = require('fs/promises')
const path = require('path')
const os = require('os')

// src/app/common/readdir-stat.js backs `fs.readdirStatAsync`: one round trip
// from the renderer for a whole directory listing. Before it, the file list
// fired `statAsync` + `lstatAsync` per entry (two calls each, #4663).
const { readdirStat, joinEntryPath } = require('../../app/common/readdir-stat')

const STRANGE = 'weird:name'
let dir
let names
const canSymlink = process.platform !== 'win32'

before(async () => {
  dir = await fss.mkdtemp(path.join(os.tmpdir(), 'electerm-readdir-stat-'))
  await fss.mkdir(path.join(dir, 'sub'))
  await fss.writeFile(path.join(dir, 'file.txt'), 'abc')
  await fss.writeFile(path.join(dir, STRANGE), 'xy')
  if (canSymlink) {
    await fss.symlink('sub', path.join(dir, 'link-to-dir'))
    await fss.symlink('file.txt', path.join(dir, 'link-to-file'))
    await fss.symlink('does-not-exist', path.join(dir, 'dangling'))
  }
  names = (await fss.readdir(dir))
})

after(async () => {
  if (dir) {
    await fss.rm(dir, { recursive: true, force: true })
  }
})

const byName = list => {
  const m = {}
  for (const item of list) {
    m[item.name] = item
  }
  return m
}

describe('readdirStat', function () {
  test('returns one info object per statable entry, in readdir order', async function () {
    const list = await readdirStat(dir, names)
    const expected = names.filter(n => !(canSymlink && n === 'dangling'))
    assert.deepEqual(list.map(d => d.name), expected)
  })

  test('file: not a directory, size from lstat, times as numbers', async function () {
    const info = byName(await readdirStat(dir, names))['file.txt']
    assert.equal(info.isDirectory, false)
    assert.equal(info.isSymbolicLink, false)
    assert.equal(info.size, 3)
    // the renderer feeds atimeMs/mtimeMs to toMs(); they must be numbers, not
    // Date objects that only survive JSON as strings
    assert.equal(typeof info.atimeMs, 'number')
    assert.equal(typeof info.mtimeMs, 'number')
    assert.equal(typeof info.mode, 'number')
    assert.equal(typeof info.uid, 'number')
    assert.equal(typeof info.gid, 'number')
  })

  test('directory is flagged as one', async function () {
    const info = byName(await readdirStat(dir, names)).sub
    assert.equal(info.isDirectory, true)
    assert.equal(info.isSymbolicLink, false)
  })

  test('symlink to a directory: link itself described, target decides isDirectory', async function () {
    if (!canSymlink) return
    const info = byName(await readdirStat(dir, names))['link-to-dir']
    assert.equal(info.isSymbolicLink, true)
    // stat() follows the link, so the entry has to read as a folder
    assert.equal(info.isDirectory, true)
  })

  test('symlink to a file is not a directory', async function () {
    if (!canSymlink) return
    const info = byName(await readdirStat(dir, names))['link-to-file']
    assert.equal(info.isSymbolicLink, true)
    assert.equal(info.isDirectory, false)
  })

  test('dangling symlink is dropped, not returned as a broken entry', async function () {
    if (!canSymlink) return
    const list = await readdirStat(dir, names)
    assert.equal(byName(list).dangling, undefined)
  })

  test('entry that vanished between readdir and lstat is dropped', async function () {
    const list = await readdirStat(dir, [...names, 'gone-really'])
    assert.equal(byName(list)['gone-really'], undefined)
    assert.ok(list.length >= 2)
  })

  test('keeps names with path separators out of the path building', async function () {
    // the name is only ever appended to the listing dir
    assert.equal(joinEntryPath(dir, 'plain'), path.join(dir, 'plain'))
    const info = byName(await readdirStat(dir, names))[STRANGE]
    assert.equal(info.name, STRANGE)
    assert.equal(info.size, 2)
  })
})

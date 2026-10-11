const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  createDialogLastDir
} = require('../../../src/app/lib/dialog-last-dir')

const openKey = 'last-dialog-open-dir'
const saveKey = 'last-dialog-save-dir'

const silentLog = {
  error () {}
}

function make (initial = {}, storeOverrides = {}) {
  const data = { ...initial }
  const store = {
    data,
    get: async (key) => data[key],
    set: async (key, value) => {
      data[key] = value
    },
    ...storeOverrides
  }
  return {
    data,
    ...createDialogLastDir({
      get: store.get,
      set: store.set,
      log: silentLog
    })
  }
}

describe('dialog-last-dir withDefaultPath', () => {
  it('leaves args untouched when nothing is remembered', async () => {
    const { withDefaultPath } = make()
    const opts = { title: 'Choose a file' }
    const res = await withDefaultPath([opts], 'open')
    assert.deepEqual(res, [opts])
    assert.equal('defaultPath' in res[0], false)
  })

  it('injects the remembered directory', async () => {
    const dir = path.join(path.sep, 'a', 'b')
    const { withDefaultPath } = make({ [openKey]: dir })
    const res = await withDefaultPath([{ title: 'x' }], 'open')
    assert.equal(res[0].defaultPath, dir)
    assert.equal(res[0].title, 'x')
  })

  it('keeps an absolute defaultPath from the caller', async () => {
    const remembered = path.join(path.sep, 'a', 'b')
    const own = path.join(path.sep, 'c', 'd.log')
    const { withDefaultPath } = make({ [openKey]: remembered })
    const res = await withDefaultPath([{ defaultPath: own }], 'open')
    assert.equal(res[0].defaultPath, own)
  })

  it('anchors a bare file name to the remembered directory', async () => {
    const remembered = path.join(path.sep, 'a', 'b')
    const { withDefaultPath } = make({ [saveKey]: remembered })
    const res = await withDefaultPath([{ defaultPath: 'term.log' }], 'save')
    assert.equal(res[0].defaultPath, path.join(remembered, 'term.log'))
  })

  it('leaves a bare file name alone when nothing is remembered', async () => {
    const { withDefaultPath } = make()
    const res = await withDefaultPath([{ defaultPath: 'term.log' }], 'save')
    assert.equal(res[0].defaultPath, 'term.log')
  })

  it('lets a save dialog fall back to the open dialog directory', async () => {
    const dir = path.join(path.sep, 'a', 'b')
    const { withDefaultPath } = make({ [openKey]: dir })
    const res = await withDefaultPath([{ title: 'save' }], 'save')
    assert.equal(res[0].defaultPath, dir)
  })

  it('prefers its own directory over the other kind', async () => {
    const openDir = path.join(path.sep, 'a', 'b')
    const saveDir = path.join(path.sep, 'c', 'd')
    const { withDefaultPath } = make({
      [openKey]: openDir,
      [saveKey]: saveDir
    })
    const openRes = await withDefaultPath([{}], 'open')
    const saveRes = await withDefaultPath([{}], 'save')
    assert.equal(openRes[0].defaultPath, openDir)
    assert.equal(saveRes[0].defaultPath, saveDir)
  })

  it('does not mutate the caller options object', async () => {
    const dir = path.join(path.sep, 'a', 'b')
    const { withDefaultPath } = make({ [openKey]: dir })
    const opts = { title: 'x' }
    await withDefaultPath([opts], 'open')
    assert.equal('defaultPath' in opts, false)
  })

  it('keeps extra args after the options object', async () => {
    const dir = path.join(path.sep, 'a', 'b')
    const { withDefaultPath } = make({ [openKey]: dir })
    const res = await withDefaultPath([{ title: 'x' }, 'extra'], 'open')
    assert.equal(res.length, 2)
    assert.equal(res[0].defaultPath, dir)
    assert.equal(res[1], 'extra')
  })

  it('handles a missing options object', async () => {
    const empty = make()
    assert.deepEqual(await empty.withDefaultPath([], 'open'), [])

    const dir = path.join(path.sep, 'a', 'b')
    const filled = make({ [openKey]: dir })
    const res = await filled.withDefaultPath([], 'open')
    assert.equal(res[0].defaultPath, dir)
  })

  it('survives a store read failure', async () => {
    const { withDefaultPath } = make({}, {
      get: async () => {
        throw new Error('db down')
      }
    })
    const opts = { title: 'x' }
    const res = await withDefaultPath([opts], 'open')
    assert.deepEqual(res, [opts])
  })
})

describe('dialog-last-dir rememberOpenResult', () => {
  it('stores the containing directory for a file selection', async () => {
    const dir = path.join(path.sep, 'x', 'y')
    const { data, rememberOpenResult } = make()
    await rememberOpenResult(
      { properties: ['openFile'] },
      [path.join(dir, 'f.txt')]
    )
    assert.equal(data[openKey], dir)
  })

  it('stores the selected folder itself for a directory selection', async () => {
    const dir = path.join(path.sep, 'x', 'y')
    const { data, rememberOpenResult } = make()
    await rememberOpenResult({ properties: ['openDirectory'] }, [dir])
    assert.equal(data[openKey], dir)
  })

  it('stores nothing when the dialog was cancelled', async () => {
    const { data, rememberOpenResult } = make()
    await rememberOpenResult({ properties: ['openFile'] }, undefined)
    assert.equal(openKey in data, false)
  })

  it('stores nothing for an empty result', async () => {
    const { data, rememberOpenResult } = make()
    await rememberOpenResult({ properties: ['openFile'] }, [])
    assert.equal(openKey in data, false)
  })

  it('survives a store write failure', async () => {
    const { rememberOpenResult } = make({}, {
      set: async () => {
        throw new Error('disk full')
      }
    })
    await rememberOpenResult({ properties: ['openFile'] }, ['/a/f.txt'])
  })
})

describe('dialog-last-dir rememberSaveResult', () => {
  it('stores the directory of the chosen file', async () => {
    const dir = path.join(path.sep, 'p', 'q')
    const { data, rememberSaveResult } = make()
    await rememberSaveResult({
      canceled: false,
      filePath: path.join(dir, 'a.log')
    })
    assert.equal(data[saveKey], dir)
  })

  it('stores nothing when cancelled', async () => {
    const { data, rememberSaveResult } = make()
    await rememberSaveResult({ canceled: true })
    assert.equal(saveKey in data, false)
  })

  it('stores nothing without a file path', async () => {
    const { data, rememberSaveResult } = make()
    await rememberSaveResult({ canceled: false })
    assert.equal(saveKey in data, false)
  })
})

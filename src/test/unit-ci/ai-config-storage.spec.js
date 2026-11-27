const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { encrypt, decrypt } = require('../../app/lib/enc')

test('AI configurations stay encrypted across edits and the NeDB to SQLite upgrade', {
  skip: Number(process.versions.node.split('.')[0]) < 22
}, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'electerm-ai-config-'))
  const oldPath = process.env.DATA_PATH
  process.env.DATA_PATH = dir
  t.after(() => {
    if (oldPath === undefined) delete process.env.DATA_PATH
    else process.env.DATA_PATH = oldPath
    rmSync(dir, { recursive: true, force: true })
  })
  const cipher = {
    enc: str => encrypt(str, 'fixture-password'),
    dec: str => decrypt(str, 'fixture-password')
  }
  const nedb = require('../../app/lib/nedb').createDb(dir, 'user', cipher)
  const sqlite = require('../../app/lib/sqlite').createDb(dir, 'user', cipher)
  const docs = [
    { _id: 'one', nameAI: 'One', apiKeyAI: 'first-fixture-key' },
    { _id: 'two', nameAI: 'Two', apiKeyAI: 'second-fixture-key' }
  ]
  const edited = { ...docs[0], apiKeyAI: 'edited-fixture-key' }
  await nedb.dbAction('aiConfigs', 'insert', docs)
  await nedb.dbAction('aiConfigs', 'update', { _id: 'one' }, { $set: edited })
  assert.deepEqual(await nedb.dbAction('aiConfigs', 'findOne', { _id: 'one' }), edited)

  const files = join(dir, 'users', 'user')
  const raw = readFileSync(join(files, 'electerm.aiConfigs.nedb'), 'utf8')
  assert.doesNotMatch(raw, /fixture-key/)
  for (const line of raw.trim().split('\n')) {
    sqlite.importNedbRecord('aiConfigs', JSON.parse(line))
  }
  assert.deepEqual(await sqlite.dbAction('aiConfigs', 'findOne', { _id: 'one' }), edited)
  assert.deepEqual(await sqlite.dbAction('aiConfigs', 'findOne', { _id: 'two' }), docs[1])

  await sqlite.dbAction('aiConfigs', 'update', { _id: 'one' }, { $set: docs[0] })
  assert.deepEqual(await sqlite.dbAction('aiConfigs', 'findOne', { _id: 'one' }), docs[0])
  assert.equal(readFileSync(join(files, 'electerm.db')).includes('fixture-key'), false)
})

/**
 * Unit tests for nedb.js and sqlite.js enc/dec support.
 * Uses Node's built-in test runner (node:test).
 *
 * Run with:
 *   node --test test/unit/db-enc.spec.js
 */

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert/strict')
const os = require('os')
const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Simple reversible enc/dec for tests (XOR-rotate + base64)
// ---------------------------------------------------------------------------
// const TEST_ENC_PREFIX = 'enc:'

function simpleEnc (str) {
  return Buffer.from(str).toString('base64')
}

function simpleDec (str) {
  return Buffer.from(str, 'base64').toString('utf8')
}

const encOpts = { enc: simpleEnc, dec: simpleDec }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTmpDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-test-'))
}

// ---------------------------------------------------------------------------
// SQLite tests (Node >= 22)
// ---------------------------------------------------------------------------
describe('sqlite createDb', () => {
  const { createDb } = require('../../src/app/lib/sqlite')

  // --- without enc/dec ---
  describe('without enc/dec', () => {
    let db
    let tmpDir

    before(() => {
      tmpDir = makeTmpDir()
      db = createDb(tmpDir, 'testuser')
    })

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    test('insert and find returns original data', async () => {
      const doc = { host: 'example.com', port: 22 }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      assert.ok(inserted._id, 'inserted document should have _id')
      assert.equal(inserted.host, 'example.com')

      const results = await db.dbAction('bookmarks', 'find')
      assert.equal(results.length, 1)
      assert.equal(results[0].host, 'example.com')
      assert.equal(results[0].port, 22)
    })

    test('findOne returns correct document', async () => {
      const doc = { host: 'other.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'other.com')
    })

    test('update modifies data', async () => {
      const doc = { host: 'update-me.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      await db.dbAction('bookmarks', 'update', { _id: inserted._id }, { $set: { host: 'updated.com' } })
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'updated.com')
    })

    test('remove deletes document', async () => {
      const doc = { host: 'remove-me.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      const changes = await db.dbAction('bookmarks', 'remove', { _id: inserted._id })
      assert.ok(changes >= 1)
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found, null)
    })

    test('non-enc table (lastStates) stores data normally', async () => {
      const doc = { key: 'value' }
      const inserted = await db.dbAction('lastStates', 'insert', doc)
      const found = await db.dbAction('lastStates', 'findOne', { _id: inserted._id })
      assert.equal(found.key, 'value')
    })
  })

  // --- with enc/dec ---
  describe('with enc/dec', () => {
    let db
    let tmpDir
    let dbFolder

    before(() => {
      tmpDir = makeTmpDir()
      dbFolder = path.join(tmpDir, 'electerm', 'users', 'testuser')
      db = createDb(tmpDir, 'testuser', encOpts)
    })

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    test('inserted bookmarks data is encrypted on disk', async () => {
      const doc = { host: 'secret.com', password: 'hunter2' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      assert.ok(inserted._id)

      // Read raw sqlite file to confirm the value is not plain text
      const dbPath = path.join(dbFolder, 'electerm.db')
      const raw = fs.readFileSync(dbPath, 'latin1')
      assert.ok(!raw.includes('hunter2'), 'raw db should NOT contain plaintext password')
      assert.ok(!raw.includes('secret.com'), 'raw db should NOT contain plaintext host')
    })

    test('find returns decrypted data', async () => {
      const results = await db.dbAction('bookmarks', 'find')
      const found = results.find(r => r.host === 'secret.com')
      assert.ok(found, 'should find the document with decrypted host')
      assert.equal(found.password, 'hunter2')
    })

    test('findOne returns decrypted data', async () => {
      const doc = { host: 'findone.com', user: 'alice' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'findone.com')
      assert.equal(found.user, 'alice')
    })

    test('update encrypts new value and find decrypts it', async () => {
      const doc = { host: 'todo-update.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      await db.dbAction('bookmarks', 'update', { _id: inserted._id }, { $set: { host: 'updated-enc.com' } })
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'updated-enc.com')
    })

    test('data table: only userConfig record is encrypted', async () => {
      // userConfig should be encrypted
      await db.dbAction('data', 'insert', { _id: 'userConfig', value: 'topSecret123' })
      // other data record should NOT be encrypted
      await db.dbAction('data', 'insert', { _id: 'version', value: '1.0.0' })
      const dbPath = path.join(dbFolder, 'electerm_data.db')
      const raw = fs.readFileSync(dbPath, 'latin1')
      assert.ok(!raw.includes('topSecret123'), 'userConfig value should NOT be plaintext on disk')
      assert.ok(raw.includes('1.0.0'), 'non-userConfig data should be plaintext on disk')
    })

    test('data find returns decrypted userConfig, plain others', async () => {
      const results = await db.dbAction('data', 'find')
      const uc = results.find(r => r._id === 'userConfig')
      const ver = results.find(r => r._id === 'version')
      assert.ok(uc, 'should find userConfig')
      assert.equal(uc.value, 'topSecret123', 'userConfig value should be decrypted')
      assert.ok(ver, 'should find version')
      assert.equal(ver.value, '1.0.0', 'version value should be readable')
    })

    test('profiles table is encrypted', async () => {
      const doc = { name: 'myProfile', secret: 'profileSecret' }
      await db.dbAction('profiles', 'insert', doc)
      const dbPath = path.join(dbFolder, 'electerm.db')
      const raw = fs.readFileSync(dbPath, 'latin1')
      assert.ok(!raw.includes('profileSecret'), 'profiles db should NOT contain plaintext secret')
    })

    test('non-enc table (quickCommands) is NOT encrypted', async () => {
      const doc = { cmd: 'ls -la' }
      await db.dbAction('quickCommands', 'insert', doc)
      const dbPath = path.join(dbFolder, 'electerm.db')
      const raw = fs.readFileSync(dbPath, 'latin1')
      assert.ok(raw.includes('ls -la'), 'non-enc tables should store data as plaintext')
    })

    test('remove works on enc table', async () => {
      const doc = { host: 'to-delete.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      const changes = await db.dbAction('bookmarks', 'remove', { _id: inserted._id })
      assert.ok(changes >= 1)
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found, null)
    })
  })
})

// ---------------------------------------------------------------------------
// nedb tests (works on all Node versions)
// ---------------------------------------------------------------------------
describe('nedb createDb', () => {
  const { createDb } = require('../../src/app/lib/nedb')

  // --- without enc/dec ---
  describe('without enc/dec', () => {
    let db
    let tmpDir

    before(() => {
      tmpDir = makeTmpDir()
      db = createDb(tmpDir, 'testuser')
    })

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    test('insert and find returns original data', async () => {
      const doc = { host: 'example.com', port: 22 }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      assert.ok(inserted._id)
      assert.equal(inserted.host, 'example.com')

      const results = await db.dbAction('bookmarks', 'find', {})
      assert.ok(results.some(r => r.host === 'example.com'))
    })

    test('findOne returns correct document', async () => {
      const doc = { host: 'other.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'other.com')
    })

    test('update modifies data', async () => {
      const doc = { host: 'update-me.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      await db.dbAction('bookmarks', 'update', { _id: inserted._id }, { $set: { host: 'updated.com' } })
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'updated.com')
    })

    test('remove deletes document', async () => {
      const doc = { host: 'remove-me.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      await db.dbAction('bookmarks', 'remove', { _id: inserted._id })
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found, null)
    })
  })

  // --- with enc/dec ---
  describe('with enc/dec', () => {
    let db
    let tmpDir

    before(() => {
      tmpDir = makeTmpDir()
      db = createDb(tmpDir, 'testuser', encOpts)
    })

    after(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    test('inserted bookmarks data is encrypted on disk', async () => {
      const doc = { host: 'secret.com', password: 'hunter2' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      assert.ok(inserted._id)

      // Read raw nedb file to confirm the value is not plain text
      const nedbPath = path.join(
        tmpDir, 'electerm', 'users', 'testuser', 'electerm.bookmarks.nedb'
      )
      const raw = fs.readFileSync(nedbPath, 'utf8')
      assert.ok(!raw.includes('hunter2'), 'nedb file should NOT contain plaintext password')
      assert.ok(!raw.includes('secret.com'), 'nedb file should NOT contain plaintext host')
    })

    test('find returns decrypted data', async () => {
      const results = await db.dbAction('bookmarks', 'find', {})
      const found = results.find(r => r.host === 'secret.com')
      assert.ok(found, 'should find the document with decrypted host')
      assert.equal(found.password, 'hunter2')
    })

    test('findOne returns decrypted data', async () => {
      const doc = { host: 'findone.com', user: 'bob' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'findone.com')
      assert.equal(found.user, 'bob')
    })

    test('update encrypts new value and find decrypts it', async () => {
      const doc = { host: 'todo-update.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      await db.dbAction('bookmarks', 'update', { _id: inserted._id }, { $set: { host: 'updated-enc.com' } })
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found.host, 'updated-enc.com')
    })

    test('data table: only userConfig record is encrypted', async () => {
      await db.dbAction('data', 'insert', { _id: 'userConfig', secret: 'mySecret' })
      await db.dbAction('data', 'insert', { _id: 'version', value: '1.0.0' })
      const nedbPath = path.join(
        tmpDir, 'electerm', 'users', 'testuser', 'electerm.data.nedb'
      )
      const raw = fs.readFileSync(nedbPath, 'utf8')
      assert.ok(!raw.includes('mySecret'), 'userConfig secret should NOT be plaintext in nedb')
      assert.ok(raw.includes('1.0.0'), 'non-userConfig data should be plaintext in nedb')
    })

    test('data find returns decrypted userConfig, plain others', async () => {
      const results = await db.dbAction('data', 'find', {})
      const uc = results.find(r => r._id === 'userConfig')
      const ver = results.find(r => r._id === 'version')
      assert.ok(uc, 'should find userConfig')
      assert.equal(uc.secret, 'mySecret', 'userConfig secret should be decrypted')
      assert.ok(ver, 'should find version')
      assert.equal(ver.value, '1.0.0', 'version value should be readable')
    })

    test('profiles table is encrypted', async () => {
      const doc = { name: 'myProfile', secret: 'profileSecret' }
      await db.dbAction('profiles', 'insert', doc)
      const nedbPath = path.join(
        tmpDir, 'electerm', 'users', 'testuser', 'electerm.profiles.nedb'
      )
      const raw = fs.readFileSync(nedbPath, 'utf8')
      assert.ok(!raw.includes('profileSecret'), 'profiles nedb should NOT contain plaintext secret')
    })

    test('non-enc table (quickCommands) is NOT encrypted', async () => {
      const doc = { cmd: 'echo hello' }
      await db.dbAction('quickCommands', 'insert', doc)
      const nedbPath = path.join(
        tmpDir, 'electerm', 'users', 'testuser', 'electerm.quickCommands.nedb'
      )
      const raw = fs.readFileSync(nedbPath, 'utf8')
      assert.ok(raw.includes('echo hello'), 'non-enc tables should store data as plaintext')
    })

    test('remove works on enc table', async () => {
      const doc = { host: 'to-delete.com' }
      const inserted = await db.dbAction('bookmarks', 'insert', doc)
      await db.dbAction('bookmarks', 'remove', { _id: inserted._id })
      const found = await db.dbAction('bookmarks', 'findOne', { _id: inserted._id })
      assert.equal(found, null)
    })
  })
})

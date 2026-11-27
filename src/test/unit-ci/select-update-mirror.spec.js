const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Readable } = require('stream')
const axios = require('axios')
const { selectMirror } = require('../../app/lib/select-update-mirror')

test('browser downloads and desktop updates use the same mirrors', () => {
  assert.deepEqual(require('../../client/common/update-mirrors.json'), require('../../app/common/update-mirrors.json'))
})

const options = { tag: 'v5.15.0', src: 'win-x64-portable.tar.gz' }

test('selects the first mirror delivering a complete binary sample and stops competing requests', async t => {
  let probeSignal
  const calls = []
  t.mock.method(axios, 'get', async (url, config) => {
    calls.push(url)
    assert.equal(config.headers.Range, 'bytes=0-262143')
    probeSignal = config.signal
    if (url.startsWith('https://github.com')) {
      return { status: 200, headers: { 'content-type': 'text/html' }, data: Readable.from([Buffer.alloc(262144)]) }
    }
    if (url.startsWith('https://atomgit.com')) {
      return { status: 206, headers: { 'content-range': 'bytes 0-262143/999999' }, data: Readable.from([Buffer.alloc(262144)]) }
    }
    return new Promise((resolve, reject) => config.signal.addEventListener('abort', () => reject(new Error('aborted'))))
  })
  assert.equal(await selectMirror({ ...options, signal: new AbortController().signal }), 'atomgit')
  assert.equal(calls.length, 5)
  assert.ok(calls.includes('https://r2.electerm.org/r/electerm-5.15.0-win-x64-portable.tar.gz'))
  assert.ok(calls.every(url => url.includes('electerm-5.15.0-win-x64-portable.tar.gz')))
  assert.ok(probeSignal.aborted)
})

test('uses GitHub if no mirror supplies a full sample', async t => {
  t.mock.method(axios, 'get', async () => ({ status: 200, headers: {}, data: Readable.from([Buffer.alloc(12)]) }))
  assert.equal(await selectMirror({ ...options, signal: new AbortController().signal }), 'github')
})

test('cancelling the speed test prevents fallback and aborts all probes', async t => {
  const controller = new AbortController()
  let aborted = 0
  t.mock.method(axios, 'get', async (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted++; reject(new Error('aborted')) })
  }))
  const result = selectMirror({ ...options, signal: controller.signal })
  controller.abort()
  await assert.rejects(result, /cancelled/)
  assert.equal(aborted, 5)
})

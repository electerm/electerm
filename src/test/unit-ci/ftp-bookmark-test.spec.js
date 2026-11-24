const { test } = require('node:test')
const assert = require('node:assert/strict')
const FtpSrv = require('@electerm/ftp-srv')
const { testTerm } = require('../../app/server/session-api')

test('FTP bookmark test authenticates with the FTP server', async t => {
  const server = new FtpSrv({
    url: 'ftp://127.0.0.1:0',
    endOnProcessSignal: false
  })
  server.on('login', ({ username, password }, resolve, reject) => {
    if (username === 'tester' && password === 'valid') {
      resolve({ root: __dirname })
    } else {
      reject(new Error('Invalid credentials'))
    }
  })
  await server.listen()
  t.after(() => server.close())

  const bookmark = {
    type: 'ftp',
    host: '127.0.0.1',
    port: server.server.address().port,
    user: 'tester',
    password: 'valid'
  }
  assert.equal(await testTerm(bookmark), true)
  await assert.rejects(testTerm({ ...bookmark, password: 'invalid' }), { code: 530 })
})

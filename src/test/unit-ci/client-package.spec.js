const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const checkClientPackage = require('../../build/bin/check-client-package')

test('electerm-react client modules build within the published source tree', async () => {
  await checkClientPackage(path.resolve(__dirname, '../../client'))
})

test('electerm-react rejects imports from sibling server sources even when present', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'electerm-react-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const client = path.join(root, 'client')
  fs.mkdirSync(client)
  fs.mkdirSync(path.join(root, 'app'))
  fs.writeFileSync(path.join(root, 'app', 'helper.js'), 'export default 1')
  fs.writeFileSync(path.join(client, 'entry.js'), "export { default } from '../app/helper.js'")
  await assert.rejects(checkClientPackage(client), /imports outside the published client directory/)
})

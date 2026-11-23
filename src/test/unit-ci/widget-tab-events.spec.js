const { test } = require('node:test')
const assert = require('node:assert/strict')
const { once, EventEmitter } = require('node:events')

test('tab subscriptions receive only public fields and close tabs in their own window', async t => {
  const closed = new EventEmitter()
  global.window = { et: { isWin: true }, store: { delTab: id => closed.emit('close', id) } }
  t.after(() => { delete global.window })
  const { publishTabEvent, widgetTabChannel } = await import('../../client/common/widget-tab-events.js')
  const channel = widgetTabChannel()
  t.after(() => channel.dispose())
  const tab = {
    id: '1',
    title: 'Example',
    type: 'rdp',
    status: 'processing',
    nativeRdp: true,
    port: 3389,
    isPinned: false,
    password: 'secret',
    privateKey: 'secret',
    setEnv: 'TOKEN=secret',
    url: 'https://example.test/?token=secret',
    connectionHoppings: [{ password: 'secret' }],
    unknownField: 'secret',
    options: { token: 'secret' }
  }
  publishTabEvent('tabOpen', tab)
  let port
  channel.connect({
    contentWindow: {
      postMessage: (data, origin, ports) => { port = ports[0] }
    }
  })
  const [opened] = await once(port, 'message')
  assert.equal(opened.event, 'tabOpen')
  assert.deepEqual(opened.tab, {
    id: '1', title: 'Example', type: 'rdp', status: 'processing', port: 3389, isPinned: false, nativeRdp: true
  })
  publishTabEvent('tabStatusChange', { id: '2', host: 'host', username: 'sam', cipher: ['aes256-ctr'], color: { token: 'secret' } })
  const [updated] = await once(port, 'message')
  assert.equal(updated.event, 'tabStatusChange')
  assert.deepEqual(updated.tab, {
    id: '2', title: '', type: 'ssh', status: '', host: 'host', username: 'sam', cipher: ['aes256-ctr']
  })
  publishTabEvent('tabOpen', { id: '3', type: 'serial', path: 'COM3', baudRate: 9600, xon: false })
  const [serial] = await once(port, 'message')
  assert.deepEqual(serial.tab, {
    id: '3', title: '', status: '', type: 'serial', path: 'COM3', baudRate: 9600, xon: false
  })
  window.et.isWebApp = true
  publishTabEvent('tabStatusChange', { ...tab, status: 'success' })
  const [embedded] = await once(port, 'message')
  assert.equal(embedded.tab.nativeRdp, false)
  port.postMessage({ method: 'closeTab', id: opened.tab.id })
  assert.deepEqual(await once(closed, 'close'), ['1'])
})

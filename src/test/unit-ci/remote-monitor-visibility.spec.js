const { test } = require('node:test')
const assert = require('node:assert/strict')

test('Info panel suppresses the bar without changing the saved preference', async () => {
  const { isRemoteMonitorBarVisible } = await import('../../client/components/remote-monitor/visibility.js')
  const tab = { id: 'ssh', type: 'ssh', host: 'example.test', pane: 'terminal' }
  const store = {
    activeTabId: tab.id,
    tabs: [tab],
    config: { remoteMonitorBarEnabled: true },
    rightPanelTab: 'info',
    rightPanelVisible: false
  }
  assert.equal(isRemoteMonitorBarVisible(store), true)
  store.rightPanelVisible = true
  for (const pinned of [false, true]) {
    store.rightPanelPinned = pinned
    assert.equal(isRemoteMonitorBarVisible(store), false)
  }
  store.rightPanelTab = 'ai'
  assert.equal(isRemoteMonitorBarVisible(store), true)
  store.rightPanelTab = 'info'
  store.rightPanelVisible = false
  assert.equal(isRemoteMonitorBarVisible(store), true)
  assert.equal(store.config.remoteMonitorBarEnabled, true)
  store.config.remoteMonitorBarEnabled = false
  assert.equal(isRemoteMonitorBarVisible(store), false)
})

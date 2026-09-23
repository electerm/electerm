export function getRemoteMonitorTab (store) {
  return store.tabs.find(tab => tab.id === store.activeTabId) || store.currentTab
}

export function isRemoteMonitorBarVisible (store) {
  const tab = getRemoteMonitorTab(store)
  // Read the pane explicitly so the Manate observer refreshes the global row
  // when an SSH tab switches between terminal and SFTP views.
  const pane = tab?.pane
  const isSsh = tab?.host && (
    tab.type === 'ssh' || tab.type === undefined
  )
  return !!store.config.remoteMonitorBarEnabled &&
    !!isSsh &&
    pane !== undefined &&
    !store.showModal &&
    !(store.rightPanelVisible && store.rightPanelTab === 'info')
}

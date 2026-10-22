/**
 * Open a terminal tab requested by a widget.
 *
 * Content from a widget can carry decrypted credentials, so the tab is tagged
 * `from: widget:<id>` and tab.js keeps those out of connection history. The
 * widget id is also the default origin, so a widget that suggests its own
 * `from` cannot pretend to be a normal user connection.
 */
import newTerm from '../../common/new-terminal'

export default function openWidgetTab (widgetId, tab) {
  if (!tab || typeof tab !== 'object' || Array.isArray(tab)) {
    throw new Error('openTab needs a tab object')
  }
  const newTab = {
    ...newTerm(true),
    ...tab,
    from: `widget:${widgetId}`
  }
  window.store.addTab(newTab)
  return { id: window.store.activeTabId, success: true }
}

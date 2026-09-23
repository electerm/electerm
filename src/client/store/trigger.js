/**
 * declarative auto triggers (ZocRespond style) related functions
 * global triggers live in store.triggers (persisted via db watch),
 * bookmark triggers live on bookmark/tab `triggers` field
 */

import { settingMap } from '../common/constants'
import { refs } from '../components/common/ref'
import { validateTriggers } from '../components/terminal/automation/trigger-engine.js'

export function normalizeTrigger (t = {}) {
  return {
    id: t.id || '',
    name: t.name || '',
    enabled: t.enabled !== false,
    match: {
      type: t.match?.type === 'regex' ? 'regex' : 'text',
      value: t.match?.value || '',
      caseSensitive: !!t.match?.caseSensitive
    },
    action: {
      type: t.action?.type === 'notify' ? 'notify' : 'send',
      value: t.action?.value || ''
    },
    sendEnter: t.sendEnter !== false,
    mode: ['repeat', 'once', 'cooldown'].includes(t.mode) ? t.mode : 'cooldown',
    cooldownMs: Number.isFinite(+t.cooldownMs) ? +t.cooldownMs : 500
  }
}

export default Store => {
  Store.prototype.addTrigger = function (trigger) {
    window.store.addItem(normalizeTrigger(trigger), settingMap.triggers)
    window.store.refreshAllTriggers()
  }

  Store.prototype.editTrigger = function (id, update) {
    window.store.editItem(id, normalizeTrigger({ ...window.store.triggers.find(t => t.id === id), ...update }), settingMap.triggers)
    window.store.refreshAllTriggers()
  }

  Store.prototype.delTrigger = function ({ id }) {
    window.store.delItem({ id }, settingMap.triggers)
    window.store.refreshAllTriggers()
  }

  Store.prototype.setTriggers = function (list) {
    const arr = (list || []).map(normalizeTrigger)
    const errors = validateTriggers(arr)
    if (errors.length) {
      return errors
    }
    window.store.setItems(settingMap.triggers, arr)
    window.store.refreshAllTriggers()
    return []
  }

  // effective triggers for a tab: predefined (global) triggers resolved with
  // per-session on/off overrides + tab session/bookmark triggers.
  // Only predefined triggers persist (db, synced); bookmark triggers stay on
  // the bookmark record; session temp rules live on the in-memory tab only.
  Store.prototype.getEffectiveTriggers = function (tab) {
    const overrides = (tab && tab.triggerOverrides) || {}
    const globals = (window.store.triggers || [])
      .filter(t => t && t.match && t.match.value)
      .map(t => {
        const on = t.id in overrides ? overrides[t.id] : t.enabled !== false
        return normalizeTrigger({ ...t, enabled: on })
      })
    const session = (tab && tab.triggers) || []
    return [...globals, ...session.map(normalizeTrigger)]
      .filter(t => t.enabled !== false && t.match.value)
  }

  // per-session on/off for a predefined trigger (memory only, not persisted)
  Store.prototype.togglePredefinedTrigger = function (tabId, triggerId, enabled) {
    const id = tabId || window.store.activeTabId
    const tab = window.store.tabs.find(t => t.id === id)
    if (!tab) {
      return
    }
    const overrides = { ...(tab.triggerOverrides || {}) }
    overrides[triggerId] = !!enabled
    window.store.updateTab(id, { triggerOverrides: overrides })
    refs.get('term-' + id)?.refreshTriggers?.()
  }

  Store.prototype.getSessionTriggers = function (tabId) {
    const tab = window.store.tabs.find(t => t.id === (tabId || window.store.activeTabId))
    return (tab && tab.triggers) || []
  }

  Store.prototype.setSessionTriggers = function (tabId, list) {
    const id = tabId || window.store.activeTabId
    const arr = (list || []).map(normalizeTrigger)
    const errors = validateTriggers(arr.filter(t => t.match.value || t.name))
    if (errors.length) {
      return errors
    }
    window.store.updateTab(id, { triggers: arr })
    refs.get('term-' + id)?.refreshTriggers?.()
    return []
  }

  Store.prototype.refreshAllTriggers = function () {
    for (const tab of window.store.tabs || []) {
      try {
        refs.get('term-' + tab.id)?.refreshTriggers?.()
      } catch (e) {
        console.debug(e)
      }
    }
  }

  Store.prototype.toggleTriggerSessionModal = function (open = null) {
    window.store.triggerSessionOpen = open == null ? !window.store.triggerSessionOpen : !!open
  }
}

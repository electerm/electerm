/**
 * widgets related functions
 */

import message from '../components/common/message'
import {
  settingMap,
  settingPanelMobileBreakpoint
} from '../common/constants'
import getInitItem from '../common/init-setting-item'
import deepCopy from 'json-deep-copy'
import generate from '../common/uid'
import { noteWidgets } from '../common/credential-provider.jsx'
import { safeGetItemJSON, safeSetItemJSON } from '../common/safe-local-storage'

// A widget with its own UI has no generated form: it keeps its config through
// window.electerm.updateConfig, which lands in localStorage. Autorun should
// start with the latest values (e.g. a provider switched in the widget panel),
// not with the config snapshot taken when it was first started.
function savedWidgetConfig (widgetId) {
  const stored = safeGetItemJSON(`widget-config-${widgetId}`, {})
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
}

export default Store => {
  Store.prototype.listWidgets = async () => {
    const widgets = await window.pre.runGlobalAsync('listWidgets')
    // a password manager widget among them (bookmark form, connect)
    noteWidgets(widgets)
    return widgets
  }

  Store.prototype.runWidget = async (widgetId, config) => {
    // If this is MCP server widget, initialize MCP handler first
    if (widgetId === 'mcp-server') {
      window.store.initMcpHandler()
    }
    return window.pre.runGlobalAsync('runWidget', widgetId, config)
  }

  Store.prototype.deleteWidgetInstance = (instanceId) => {
    const {
      widgetInstances
    } = window.store
    // assigned, not spliced: an in-place mutation fires no subscriber, and the
    // instance list, the sidebar badge and the detail panel all read this array
    window.store.widgetInstances = widgetInstances.filter(w => w.id !== instanceId)
  }

  // Selecting a running instance in the widgets list shows its detail + log in
  // the right column, the same way selecting a widget shows its run form.
  Store.prototype.selectWidgetInstance = (instance) => {
    const { store } = window
    store.setSettingItem(instance)
    // narrow panels drill into the right col content after picking an instance
    if (window.store.innerWidth <= settingPanelMobileBreakpoint) {
      window.store.settingMobileView = 'content'
    }
  }

  // back to the widget form — used when the instance being viewed is gone
  Store.prototype.closeWidgetInstance = () => {
    const { store } = window
    store.setSettingItem(getInitItem([], settingMap.widgets))
  }

  Store.prototype.stopWidget = async (instanceId) => {
    const {
      store
    } = window
    const r = await window.pre.runGlobalAsync('stopWidget', instanceId)
      .catch(err => {
        console.error('stopWidget error', err)
        message.error(window.translate('stopWidgetFailed') + ': ' + err.message)
        return false
      })
    if (r) {
      store.deleteWidgetInstance(instanceId)
    }
  }

  Store.prototype.runWidgetFunc = async (instanceId, funcName, ...args) => {
    return window.pre.runGlobalAsync('runWidgetFunc', instanceId, funcName, ...args)
  }

  // Apply the AI config a widget proposed with its result (see
  // app/widgets/ai-config.js, which whitelists the fields in the main process).
  // The renderer writes it, on purpose: store.config is what the AI settings
  // form edits and what the watcher persists, so a widget's offer goes through
  // exactly the same path as a hand-typed one instead of around it.
  Store.prototype.applyWidgetAIConfig = (aiConfig) => {
    if (!aiConfig || typeof aiConfig !== 'object') {
      return
    }
    const patch = {}
    for (const key of Object.keys(aiConfig)) {
      if (typeof aiConfig[key] === 'string') {
        patch[key] = aiConfig[key]
      }
    }
    if (!Object.keys(patch).length) {
      return
    }
    window.store.updateConfig(patch)
    message.success('AI settings updated')
  }

  Store.prototype.openWidgetsModal = () => {
    const {
      store
    } = window
    store.setSettingItem(getInitItem([], settingMap.widgets))
    store.settingTab = settingMap.widgets
    store.openSettingModal()
  }

  // Autorun has two UIs: the sidebar thunderbolt and a UI widget's own switch.
  // One idempotent setter keeps the launch list, the sidebar badge and the
  // widget's stored choice on the same value, whichever one the user used.
  Store.prototype.setWidgetAutoRun = (widgetId, enabled, config) => {
    const { store } = window
    if (!store.autoRunWidgets) {
      store.autoRunWidgets = []
    }
    const list = store.autoRunWidgets
    const index = list.findIndex(w => w.widgetId === widgetId)
    if (enabled && index < 0) {
      list.push({ id: generate(), widgetId, config: deepCopy(config || {}) })
    } else if (!enabled && index > -1) {
      list.splice(index, 1)
    }
    const item = list.find(w => w.widgetId === widgetId)
    const instance = store.widgetInstances.find(w => w.widgetId === widgetId)
    if (instance) {
      instance.autoRun = !!item
      instance.autoRunId = item ? item.id : undefined
    }
    const key = `widget-config-${widgetId}`
    const saved = safeGetItemJSON(key, {})
    const conf = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    safeSetItemJSON(key, { ...conf, autoRun: !!enabled })
  }

  Store.prototype.toggleAutoRunWidget = (instance) => {
    const { store } = window
    const { widgetId, config } = instance
    if (instance.autoRun) {
      const index = store.autoRunWidgets.findIndex(
        w => w.id === instance.autoRunId
      )
      if (index > -1) {
        store.autoRunWidgets.splice(index, 1)
      }
      instance.autoRun = false
      instance.autoRunId = undefined
    } else {
      const id = generate()
      const item = {
        id,
        widgetId,
        config
      }
      store.autoRunWidgets.push(item)
      instance.autoRun = true
      instance.autoRunId = id
    }
    // A UI widget reads this value through getConfig, so the sidebar toggle
    // and the widget's own switch never disagree.
    const key = `widget-config-${widgetId}`
    const saved = safeGetItemJSON(key, {})
    const conf = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    safeSetItemJSON(key, { ...conf, autoRun: !!instance.autoRun })
  }

  Store.prototype.startAutoRunWidgets = async function () {
    const { store } = window
    const items = store.autoRunWidgets
    if (!items || !items.length) {
      return
    }
    for (const item of items) {
      try {
        const runConfig = {
          ...deepCopy(item.config),
          ...savedWidgetConfig(item.widgetId)
        }
        // The widget's own switch can turn autorun off without the list being
        // rewritten (older saved entries, or a config restored from backup).
        if (runConfig.autoRun === false) {
          continue
        }
        const result = await store.runWidget(item.widgetId, runConfig)
        if (result && result.instanceId) {
          const instance = {
            id: result.instanceId,
            title: `${result.widgetId} (${result.instanceId})`,
            widgetId: result.widgetId,
            serverInfo: result.serverInfo,
            // an AI config the widget offers to apply, sanitised in the main
            // process (app/widgets/ai-config.js)
            aiConfig: result.aiConfig || null,
            config: item.config,
            startedAt: Date.now(),
            autoRun: true,
            autoRunId: item.id
          }
          store.widgetInstances = [...store.widgetInstances, instance]
        }
      } catch (err) {
        console.error(`Failed to autorun widget ${item.widgetId}:`, err)
      }
    }
  }
}

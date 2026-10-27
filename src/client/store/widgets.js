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

export default Store => {
  Store.prototype.listWidgets = async () => {
    return window.pre.runGlobalAsync('listWidgets')
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
  }

  Store.prototype.startAutoRunWidgets = async function () {
    const { store } = window
    const items = store.autoRunWidgets
    if (!items || !items.length) {
      return
    }
    for (const item of items) {
      try {
        const result = await store.runWidget(item.widgetId, deepCopy(item.config))
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

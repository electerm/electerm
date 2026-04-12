/**
 * widgets related functions
 */

import message from '../components/common/message'
import {
  settingMap
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
    const index = widgetInstances.findIndex(w => w.id === instanceId)
    if (index > -1) {
      widgetInstances.splice(index, 1)
    }
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
            config: item.config,
            autoRun: true,
            autoRunId: item.id
          }
          store.widgetInstances.push(instance)
        }
      } catch (err) {
        console.error(`Failed to autorun widget ${item.widgetId}:`, err)
      }
    }
  }
}

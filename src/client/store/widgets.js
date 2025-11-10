/**
 * widgets related functions
 */

import {
  message
} from 'antd'

export default Store => {
  Store.prototype.listWidgets = async () => {
    const {
      store
    } = window
    return store.pre.runGlobalAsync('listWidgets')
  }

  Store.prototype.runWidget = async (widgetId, config) => {
    const {
      store
    } = window
    return store.pre.runGlobalAsync('runWidget', widgetId, config)
  }

  Store.prototype.deleteWidggetInstance = (instanceId) => {
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
    const r = await store.pre.runGlobalAsync('stopWidget', instanceId)
      .catch(err => {
        console.error('stopWidget error', err)
        message.error(window.translate('stopWidgetFailed') + ': ' + err.message)
        return false
      })
    if (r) {
      store.deleteWidggetInstance(instanceId)
    }
  }

  Store.prototype.runWidgetFunc = async (instanceId, funcName, ...args) => {
    const {
      store
    } = window
    return store.pre.runGlobalAsync('runWidgetFunc', instanceId, funcName, ...args)
  }

  Store.prototype.restartWidget = async (instanceId) => {
    const {
      store
    } = window
    await store.stopWidget(instanceId)
    const widgetInfo = store.runningWidgets.find(w => w.instanceId === instanceId)
    if (!widgetInfo) {
      throw new Error(`No widget info found for instanceId: ${instanceId}`)
    }
    return store.runWidget(widgetInfo.widgetId, widgetInfo.config)
  }
}

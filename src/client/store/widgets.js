/**
 * widgets related functions
 */

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

  Store.prototype.stopWidget = async (instanceId) => {
    const {
      store
    } = window
    return store.pre.runGlobalAsync('stopWidget', instanceId)
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

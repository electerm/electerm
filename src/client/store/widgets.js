/**
 * widgets related functions
 */

import {
  message
} from 'antd'
import {
  settingMap
} from '../common/constants'
import getInitItem from '../common/init-setting-item'

export default Store => {
  Store.prototype.listWidgets = async () => {
    return window.pre.runGlobalAsync('listWidgets')
  }

  Store.prototype.runWidget = async (widgetId, config) => {
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
}

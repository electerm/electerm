import SettingCol from './col'
import WidgetControl from '../widgets/widget-control'
import WidgetInstanceDetail from '../widgets/widget-instance-detail'
import WidgetList from '../widgets/widgets-list'
import { auto } from 'manate/react'
import {
  settingMap
} from '../../common/constants'

export default auto(function TabWidgets (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.widgets) {
    return null
  }
  const {
    settingItem,
    listProps,
    formProps,
    store
  } = props
  // The right column shows whatever the list selected: a widget definition (run
  // form) or a running instance (its detail + log). A definition has `info`, an
  // instance has `widgetId` — and an instance that has been stopped stays the
  // selected item on purpose, so its log is still readable after it dies.
  const isInstance = !!(settingItem && settingItem.widgetId)
  return (
    <div
      className='setting-tabs-profile'
    >
      <SettingCol>
        <WidgetList
          {...listProps}
        />
        {
          isInstance
            ? (
              <WidgetInstanceDetail
                key={settingItem.id}
                instance={settingItem}
                store={store}
              />
              )
            : (
              <WidgetControl
                {...formProps}
                key={settingItem.id}
              />
              )
        }
      </SettingCol>
    </div>
  )
})

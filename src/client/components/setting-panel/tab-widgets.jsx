import SettingCol from './col'
import WidgetForm from '../widgets/widget-form'
import WdigetList from '../widgets/widgets-list'
import {
  settingMap
} from '../../common/constants'

export default function TabWidgets (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.widgets) {
    return null
  }
  const {
    settingItem,
    listProps,
    formProps
  } = props
  return (
    <div
      className='setting-tabs-profile'
    >
      <SettingCol>
        <WdigetList
          {...listProps}
        />
        <WidgetForm
          {...formProps}
          key={settingItem.id}
        />
      </SettingCol>
    </div>
  )
}

import { auto } from 'manate/react'
import SettingCol from './col'
import QuickCommandsList from '../quick-commands/quick-commands-list'
import QuickCommandsForm from '../quick-commands/quick-commands-form'
import {
  settingMap
} from '../../common/constants'

export default auto(function TabQuickCommands (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.quickCommands) {
    return null
  }
  const {
    settingItem,
    listProps,
    formProps,
    store
  } = props
  return (
    <div
      className='setting-tabs-quick-commands'
    >
      <SettingCol>
        <QuickCommandsList
          {...listProps}
          quickCommandId={store.quickCommandId}
          groupByLabel={store.qmGroupByLabel}
          collapsedLabels={store.qmCollapsedLabels}
        />
        <QuickCommandsForm
          {...formProps}
          quickCommandTags={store.quickCommandTags}
          key={settingItem.id}
        />
      </SettingCol>
    </div>
  )
})

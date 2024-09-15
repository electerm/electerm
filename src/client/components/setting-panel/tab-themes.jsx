import SettingCol from './col'
import TerminalThemeForm from '../theme/theme-form'
import TerminalThemeList from '../theme/theme-list'
import {
  settingMap
} from '../../common/constants'

export default function TabThemes (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.terminalThemes) {
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
      className='setting-tabs-terminal-themes'
    >
      <SettingCol>
        <TerminalThemeList
          {...listProps}
          theme={store.config.theme}
        />
        <TerminalThemeForm {...formProps} key={settingItem.id} />
      </SettingCol>
    </div>
  )
}

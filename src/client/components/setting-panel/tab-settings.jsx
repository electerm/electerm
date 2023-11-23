import SettingCommon from './setting-common'
import SettingTerminal from './setting-terminal'
import SettingCol from './col'
import SyncSetting from '../setting-sync/setting-sync'
import Shortcuts from '../shortcuts/shortcuts'
import List from './list'
import {
  settingMap,
  settingSyncId,
  settingTerminalId,
  settingShortcutsId
} from '../../common/constants'

export default function TabSettings (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.setting) {
    return null
  }
  const {
    settingItem,
    listProps,
    store
  } = props
  let elem = null
  const sid = settingItem.id
  if (sid === settingSyncId) {
    elem = <SyncSetting store={store} />
  } else if (sid === settingTerminalId) {
    elem = <SettingTerminal {...listProps} config={store.config} />
  } else if (sid === settingShortcutsId) {
    elem = <Shortcuts store={store} />
  } else {
    elem = <SettingCommon {...listProps} config={store.config} />
  }
  return (
    <div
      className='setting-tabs-setting'
    >
      <SettingCol>
        <List
          {...listProps}
        />
        {elem}
      </SettingCol>
    </div>
  )
}

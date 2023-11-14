import Setting from './setting'
import SettingCol from './col'
import SyncSetting from '../setting-sync/setting-sync'
import Shortcuts from '../shortcuts/shortcuts'
import List from './list'
import {
  settingMap,
  settingSyncId,
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
  } else if (sid === settingShortcutsId) {
    elem = <Shortcuts store={store} />
  } else {
    elem = <Setting {...listProps} config={store.config} />
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

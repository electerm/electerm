import { auto } from 'manate/react'
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
import { pick } from 'lodash-es'

export default auto(function TabSettings (props) {
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
    const syncProps = pick(store, [
      'config',
      'isSyncingSetting',
      'isSyncDownload',
      'isSyncUpload',
      'syncType',
      'syncServerStatus'
    ])
    elem = <SyncSetting {...syncProps} />
  } else if (sid === settingTerminalId) {
    elem = <SettingTerminal {...listProps} config={store.config} />
  } else if (sid === settingShortcutsId) {
    const shortcutsProps = {
      quickCommands: store.quickCommands,
      config: store.config
    }
    elem = <Shortcuts {...shortcutsProps} />
  } else {
    elem = (
      <SettingCommon
        {...listProps}
        config={store.config}
        bookmarks={store.bookmarks}
        bookmarkGroups={store.bookmarkGroups}
      />
    )
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
})

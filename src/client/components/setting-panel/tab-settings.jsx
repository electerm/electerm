import { auto } from 'manate/react'
import SettingCommon from './setting-common'
import SettingTerminal from './setting-terminal'
import SettingCol from './col'
import Shortcuts from '../shortcuts/shortcuts'
import SettingPasswords from './setting-passwords'
import List from './list'
import {
  settingMap,
  settingTerminalId,
  settingShortcutsId,
  settingPasswordsId
} from '../../common/constants'

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
  if (sid === settingTerminalId) {
    elem = <SettingTerminal {...listProps} config={store.config} />
  } else if (sid === settingShortcutsId) {
    const shortcutsProps = {
      quickCommands: store.quickCommands,
      config: store.config
    }
    elem = <Shortcuts {...shortcutsProps} />
  } else if (sid === settingPasswordsId) {
    const passwordsProps = {
      bookmarks: store.bookmarks,
      editItem: store.editItem,
      copyToClipboard: window.copyToClipboard
    }
    elem = <SettingPasswords {...passwordsProps} />
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

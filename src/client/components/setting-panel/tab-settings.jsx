import { auto } from 'manate/react'
import { message } from 'antd'
import SettingCommon from './setting-common'
import SettingTerminal from './setting-terminal'
import SettingCol from './col'
import SettingAi from '../ai/ai-config'
import SyncSetting from '../setting-sync/setting-sync'
import Shortcuts from '../shortcuts/shortcuts'
import List from './list'
import {
  settingMap,
  settingSyncId,
  settingTerminalId,
  settingAiId,
  settingShortcutsId
} from '../../common/constants'
import { aiConfigsArr } from '../ai/ai-config-props'
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

  function getInitialValues () {
    const res = pick(props.store.config, aiConfigsArr)
    if (!res.languageAI) {
      res.languageAI = window.store.getLangName()
    }
    return res
  }

  function handleConfigSubmit (values) {
    window.store.updateConfig(values)
    message.success('Saved')
  }

  const aiConfProps = {
    initialValues: getInitialValues(),
    onSubmit: handleConfigSubmit,
    showAIConfig: true
  }

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
  } else if (sid === settingAiId) {
    elem = <SettingAi {...aiConfProps} />
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

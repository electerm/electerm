import Setting from './setting'
import SettingCol from './col'
import SyncSetting from '../setting-sync/setting-sync'
import List from './list'
import {
  settingMap,
  settingSyncId
} from '../../common/constants'
import _ from 'lodash'

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
  return (
    <div
      className='setting-tabs-setting'
    >
      <SettingCol>
        <List
          {...listProps}
        />
        {
          settingItem.id === settingSyncId
            ? (
              <SyncSetting
                store={store}
                {...store.config.syncSetting}
                {..._.pick(store, [
                  'autofocustrigger',
                  'isSyncingSetting',
                  'isSyncDownload',
                  'isSyncUpload',
                  'syncType'
                ])}
              />
            )
            : <Setting {...listProps} config={store.config} />
        }
      </SettingCol>
    </div>
  )
}

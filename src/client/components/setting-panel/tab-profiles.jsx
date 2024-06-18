import SettingCol from './col'
import ProfileForm from '../profile/profile-form'
import ProfileList from '../profile/profile-list'
import {
  settingMap
} from '../../common/constants'

export default function TabProfiles (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.profiles) {
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
      className='setting-tabs-profile'
    >
      <SettingCol>
        <ProfileList
          {...listProps}
          quickCommandId={store.quickCommandId}
        />
        <ProfileForm
          {...formProps}
          quickCommandTags={store.quickCommandTags}
          key={settingItem.id}
        />
      </SettingCol>
    </div>
  )
}

import SettingCol from './col'
import BookmarkForm from '../bookmark-form'
import List from './list'
import {
  settingMap
} from '../../common/constants'

const { prefix } = window
const c = prefix('control')

export default function TabHistory (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.history) {
    return null
  }
  const {
    settingItem,
    listProps,
    formProps
  } = props
  return (
    <div
      className='setting-tabs-history'
    >
      <SettingCol>
        <List
          {...listProps}
        />
        {
          settingItem.id
            ? (
              <BookmarkForm
                key={settingItem.id}
                {...formProps}
              />
              )
            : <div className='form-wrap pd2 aligncenter'>{c('notFoundContent')}</div>
        }
      </SettingCol>
    </div>
  )
}

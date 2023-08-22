import SettingCol from './col'
import BookmarkForm from '../bookmark-form'
import TreeList from './bookmark-tree-list'
import {
  settingMap
} from '../../common/constants'

export default function TabBookmarks (props) {
  const {
    settingTab
  } = props
  if (settingTab !== settingMap.bookmarks) {
    return null
  }
  const {
    settingItem,
    treeProps,
    formProps
  } = props
  return (
    <div
      className='setting-tabs-bookmarks'
    >
      <SettingCol>
        <div className='model-bookmark-tree-wrap'>
          <TreeList
            {...treeProps}
          />
        </div>
        <BookmarkForm
          key={settingItem.id}
          {...formProps}
        />
      </SettingCol>
    </div>
  )
}

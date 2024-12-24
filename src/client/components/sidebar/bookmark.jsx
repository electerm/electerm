/**
 * bookmark select
 */

import BookmarkSelect from './bookmark-select'

export default function BookmarkPanel (props) {
  const { store } = window
  return (
    <div
      className='sidebar-panel-bookmarks'
    >
      <div className='pd2l sidebar-inner'>
        <BookmarkSelect store={store} from='sidebar' />
      </div>
    </div>
  )
}

import { refsStatic } from '../common/ref'
import { useEffect, useRef } from 'react'
import BookmarkSelect from './bookmark-select'
import { debounce } from 'lodash-es'

export default function BookmarkPanel (props) {
  const { store } = window
  const bookmarksPanelRef = useRef(null)
  const SCROLL_REF_ID = 'bookmarks-scroll-position'

  // On component mount, restore scroll position
  useEffect(() => {
    if (store.openedSideBar) {
      const savedPosition = refsStatic.get(SCROLL_REF_ID)
      if (savedPosition) {
        setTimeout(() => {
          bookmarksPanelRef.current.scrollTop = savedPosition
        }, 100)
      }
    }
  }, [store.openedSideBar])

  // Save scroll position when scrolling
  const handleScroll = debounce((e) => {
    const top = e.target.scrollTop
    if (top > 0) {
      refsStatic.add(SCROLL_REF_ID, e.target.scrollTop)
    }
  }, 100)

  return (
    <div className='sidebar-panel-bookmarks' ref={bookmarksPanelRef} onScroll={handleScroll}>
      <div className='pd2l sidebar-inner'>
        <BookmarkSelect store={store} from='sidebar' />
      </div>
    </div>
  )
}

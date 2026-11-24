import { StarFilled, FolderOpenOutlined } from '@ant-design/icons'
import BookmarkSelect from '../sidebar/bookmark-select'

export const railWidth = 28

export default function SessionSidebar ({ bookmarks, files, canShowFiles, onToggleBookmarks, onToggleFiles, batch, active, onActivate, children }) {
  const title = window.translate('bookmarks')
  return (
    <div className='session-sidebar'>
      <div className='session-sidebar-rail' style={{ width: railWidth }}>
        <button type='button' title={title} aria-label={title} aria-expanded={bookmarks} onClick={onToggleBookmarks}>
          <StarFilled />
        </button>
        {canShowFiles && (
          <button type='button' title='SFTP' aria-label='SFTP' aria-expanded={files} onClick={onToggleFiles}>
            <FolderOpenOutlined />
          </button>
        )}
      </div>
      <div className='session-sidebar-body'>
        {bookmarks && active && (
          <div className='session-bookmarks' onFocusCapture={onActivate} onClickCapture={onActivate} onClick={e => e.stopPropagation()}>
            <BookmarkSelect store={window.store} from='session' batch={batch} />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

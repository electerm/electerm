import { memo } from 'react'
import {
  Button,
  Alert
} from 'antd'

const e = window.translate

export default memo(function TerminalErrorHandle ({
  errorMessage,
  showEditBookmarkButton,
  onEditBookmark
}) {
  if (!errorMessage) {
    return null
  }

  function renderEditBookmarkButton () {
    if (!showEditBookmarkButton) {
      return null
    }
    return (
      <div className='terminal-error-actions pd1y'>
        <Button
          onClick={onEditBookmark}
        >
          {e('edit')} {e('bookmarks')}
        </Button>
      </div>
    )
  }

  return (
    <Alert
      className='terminal-error-handle'
      title={errorMessage}
      type='error'
      showIcon
      banner
      description={renderEditBookmarkButton()}
    />
  )
})

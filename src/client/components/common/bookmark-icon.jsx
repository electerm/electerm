import { useState } from 'react'
import { getBookmarkIconUrl } from '../../common/bookmark-icon-url.js'
import './bookmark-icon.styl'

function RemoteIcon ({ src, fallback, onError, onLoad }) {
  const [failed, setFailed] = useState(false)
  if (failed) return fallback
  return (
    <img
      className='bookmark-icon'
      src={src}
      alt=''
      draggable={false}
      referrerPolicy='no-referrer'
      onLoad={onLoad}
      onError={() => {
        setFailed(true)
        onError?.()
      }}
    />
  )
}

export default function BookmarkIcon ({ iconUrl, color, fallback, onError, onLoad }) {
  const src = getBookmarkIconUrl(iconUrl)
  const colorFallback = fallback === undefined
    ? <span className='bookmark-icon bookmark-icon-color' style={{ backgroundColor: color || '#0088cc' }} />
    : fallback
  // A new URL gets a new load/error state, including when switching bookmarks.
  return src
    ? <RemoteIcon key={src} src={src} fallback={colorFallback} onError={onError} onLoad={onLoad} />
    : colorFallback
}

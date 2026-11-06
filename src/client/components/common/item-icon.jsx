/**
 * Icon of a bookmark / bookmark group, or its colour when there is no icon.
 *
 * Rendering only ever touches three sources, see icon-value.js: a built-in
 * icon file, a local file, or the colour. A stored remote URL is not fetched.
 */

import { useEffect, useState } from 'react'
import { parseIcon } from '../../common/icon-value'
import { builtinIconUrl, loadFileIcon } from '../../common/icon-assets'
import './item-icon.styl'

export const itemIconDefaultColor = '#0088cc'

export default function ItemIcon ({
  icon,
  color,
  size = 14,
  fallback,
  className
}) {
  const parsed = parseIcon(icon)
  const filePath = parsed && parsed.type === 'file' ? parsed.path : ''
  const [fileSrc, setFileSrc] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    setFileSrc('')
    if (!filePath) {
      return
    }
    let alive = true
    loadFileIcon(filePath)
      .then(url => {
        if (alive) {
          setFileSrc(url)
        }
      })
    return () => {
      alive = false
    }
  }, [filePath])

  const colorBlock = fallback === undefined
    ? (
      <span
        className='item-icon item-icon-color'
        style={{
          width: size,
          height: size,
          backgroundColor: color || itemIconDefaultColor
        }}
      />
      )
    : fallback

  if (!parsed) {
    return colorBlock
  }

  const src = parsed.type === 'builtin'
    ? builtinIconUrl(parsed.name)
    : fileSrc

  if (!src || failed) {
    return colorBlock
  }

  return (
    <img
      className={`item-icon${className ? ' ' + className : ''}`}
      src={src}
      width={size}
      height={size}
      alt=''
      draggable={false}
      referrerPolicy='no-referrer'
      onError={() => setFailed(true)}
    />
  )
}

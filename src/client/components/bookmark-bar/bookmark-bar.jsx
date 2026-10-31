/**
 * chrome-style bookmark bar: one row of bookmarks under the tab strip.
 *
 * Toggled from the left sidebar icon bar (see left-sidebar-icons.jsx), persisted
 * as a local layout preference like the sidebar pin. It lives inside the pane's
 * tab area rather than once per window because that is where its geometry comes
 * from: the session content starts right below the tab strip, so the bar is the
 * second row of that header (see sessions.jsx and session.styl).
 *
 * Opening a bookmark targets this pane: the bar belongs to the pane's tab strip,
 * so `window.openTabBatch` is set the same way the pane's "new tab" button does.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { auto } from 'manate/react'
import { Dropdown } from 'antd'
import { DoubleRightOutlined, FolderOutlined } from '@ant-design/icons'
import createName, { createTitleTag } from '../../common/create-title'
import { defaultBookmarkGroupId } from '../../common/constants'
import tr from '../../common/tr'
import { buildBarItems } from './build-bar-items'
import './bookmark-bar.styl'

// both from bookmark-bar.styl: the fit calculation has to count them
const itemGap = 2
const overflowWidth = 32

export default auto(function BookmarkBar (props) {
  const { batch } = props
  const { store } = window
  const items = buildBarItems({
    bookmarkGroups: store.bookmarkGroups,
    bookmarksMap: store.bookmarksMap,
    defaultGroupId: defaultBookmarkGroupId
  })
  const barRef = useRef(null)
  // item key -> measured px. Filled while every item is on screen, which is the
  // only moment their width can be read; a later resize then re-decides how
  // many fit without having to render them all again.
  const widths = useRef(new Map())
  const signature = items.map(item => item.key).join('|')
  const [fit, setFit] = useState({ signature, count: Infinity })
  if (fit.signature !== signature) {
    // the item list changed, so the cached widths are stale: fall back to
    // rendering everything and let the layout effect measure again
    setFit({ signature, count: Infinity })
  }
  const count = fit.signature === signature ? fit.count : Infinity

  const openBookmark = id => {
    window.openTabBatch = batch
    store.onSelectBookmark(id)
    // onSelectBookmark consumes it; clearing again is harmless and keeps a
    // bookmark that no longer exists from leaking the batch into the next open
    delete window.openTabBatch
  }

  const toMenuItems = list => list.map(item => {
    if (item.type === 'bookmark') {
      return {
        key: item.key,
        label: (
          <span className='bookmark-bar-menu-item'>
            {createTitleTag(item.bookmark)}
            <span className='bookmark-bar-menu-name elli'>
              {createName(item.bookmark)}
            </span>
          </span>
        ),
        onClick: () => openBookmark(item.bookmark.id)
      }
    }
    return {
      key: item.key,
      label: (
        <span className='bookmark-bar-menu-item'>
          <FolderOutlined className='bookmark-bar-menu-folder' />
          <span className='bookmark-bar-menu-name elli'>
            {item.group.title}
          </span>
        </span>
      ),
      // antd renders `children` as a submenu; an empty folder needs a leaf, or
      // the item silently disappears
      children: item.children.length
        ? toMenuItems(item.children)
        : [{ key: item.key + ':empty', label: '—', disabled: true }]
    }
  })

  const renderItem = item => {
    if (item.type === 'bookmark') {
      const { bookmark } = item
      const name = createName(bookmark)
      return (
        <div
          key={item.key}
          className='bookmark-bar-item'
          data-bar-key={item.key}
          title={bookmark.description ? `${name} - ${bookmark.description}` : name}
          onClick={() => openBookmark(bookmark.id)}
        >
          {createTitleTag(bookmark)}
          <span className='bookmark-bar-name elli'>{name}</span>
        </div>
      )
    }
    return (
      <Dropdown
        key={item.key}
        trigger={['click']}
        placement='bottomLeft'
        menu={{ items: toMenuItems(item.children) }}
      >
        <div
          className='bookmark-bar-item bookmark-bar-folder'
          data-bar-key={item.key}
          title={item.group.title}
        >
          <FolderOutlined className='bookmark-bar-folder-icon' />
          <span className='bookmark-bar-name elli'>{item.group.title}</span>
        </div>
      </Dropdown>
    )
  }

  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) {
      return
    }
    const measure = () => {
      const nodes = el.querySelectorAll('[data-bar-key]')
      if (nodes.length === items.length) {
        const next = new Map()
        nodes.forEach(node => next.set(node.dataset.barKey, node.offsetWidth))
        widths.current = next
      }
      const available = el.clientWidth
      let used = 0
      let fitCount = items.length
      for (let i = 0; i < items.length; i++) {
        // reserve the » button from the start: hiding exactly one item to make
        // room for a button that opens a menu of one is not worth it, but the
        // alternative — deciding again after the button appears — oscillates
        const w = (widths.current.get(items[i].key) || 0) + itemGap
        if (used + w + overflowWidth > available) {
          fitCount = i
          break
        }
        used += w
      }
      setFit(prev => prev.count === fitCount
        ? prev
        : { signature, count: fitCount })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [signature, items.length])

  if (!items.length) {
    // nothing to show: an empty 28px strip reads as a rendering bug, and
    // store.bookmarkBarHeight reserves nothing in this case either
    return null
  }

  const visible = items.slice(0, count)
  const hidden = items.slice(count)
  return (
    <div className='bookmark-bar' ref={barRef}>
      {visible.map(renderItem)}
      {
        hidden.length
          ? (
            <Dropdown
              trigger={['click']}
              placement='bottomRight'
              menu={{ items: toMenuItems(hidden) }}
            >
              <div
                className='bookmark-bar-item bookmark-bar-overflow'
                title={tr('moreBookmarks', 'more bookmarks')}
              >
                <DoubleRightOutlined />
              </div>
            </Dropdown>
            )
          : null
      }
    </div>
  )
})

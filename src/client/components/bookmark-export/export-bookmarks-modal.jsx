/**
 * Bookmark export panel
 *
 * Opened by the `export_bookmarks` agent tool. The agent only supplies a filter
 * object; the matches are resolved here, against the live store, and shown to
 * the user. Nothing on this panel is ever sent back to the model -- the tool
 * result is a count, and the file only exists once the user clicks export.
 */

import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Empty, Flex, Tag } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import Modal from '../common/modal'
import download from '../../common/download'
import time from '../../common/time'
import {
  buildBookmarkExportPayload,
  describeBookmarkExportFilter,
  getBookmarkPort,
  getBookmarkType
} from '../../common/bookmark-export-filter'
import './export-bookmarks.styl'

const e = window.translate

function bookmarkMeta (bookmark) {
  const type = getBookmarkType(bookmark)
  if (type === 'serial') {
    return bookmark.path || ''
  }
  if (type === 'web') {
    return bookmark.url || ''
  }
  if (type === 'local') {
    return bookmark.startDirectoryLocal || ''
  }
  const port = getBookmarkPort(bookmark)
  const address = bookmark.host || ''
  return port ? `${address}:${port}` : address
}

export default function ExportBookmarksModal ({ request }) {
  const { store } = window
  const [selected, setSelected] = useState(() => new Set(request.ids))

  // a second tool call replaces the request object, and with it the selection
  useEffect(() => {
    setSelected(new Set(request.ids))
  }, [request])

  const bookmarks = store.bookmarks || []
  const rows = useMemo(() => {
    const byId = new Map(bookmarks.map(b => [b.id, b]))
    return request.ids.map(id => byId.get(id)).filter(Boolean)
  }, [bookmarks, request])

  const allChecked = rows.length > 0 && rows.every(b => selected.has(b.id))

  function close () {
    store.bookmarkExport = null
  }

  function toggle (id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll () {
    setSelected(allChecked ? new Set() : new Set(rows.map(b => b.id)))
  }

  async function handleExport () {
    const ids = rows.filter(b => selected.has(b.id)).map(b => b.id)
    if (!ids.length) {
      return
    }
    const payload = buildBookmarkExportPayload(
      store.bookmarks,
      store.bookmarkGroups,
      ids
    )
    const stamp = time(undefined, 'YYYY-MM-DD-HH-mm-ss')
    const written = await download(
      `bookmarks-${stamp}.json`,
      JSON.stringify(payload, null, 2)
    )
    // a cancelled save keeps the panel, and the selection, as it was
    if (written) {
      close()
    }
  }

  const footer = (
    <Flex justify='flex-end' gap={8}>
      <Button onClick={close}>{e('cancel')}</Button>
      <Button
        type='primary'
        icon={<ExportOutlined />}
        disabled={!selected.size}
        onClick={handleExport}
      >
        {e('export')} ({selected.size})
      </Button>
    </Flex>
  )

  const modProps = {
    title: `${e('export')} ${e('bookmarks')}`,
    footer,
    open: true,
    onCancel: close,
    width: 620
  }

  return (
    <Modal {...modProps}>
      <div className='export-bookmarks-hint'>
        {describeBookmarkExportFilter(request.filter)}
      </div>
      <Flex justify='space-between' align='center' className='pd1y'>
        <span>
          {rows.length} / {bookmarks.length} {e('bookmarks')}
        </span>
        {rows.length > 0 && (
          <Checkbox checked={allChecked} onChange={toggleAll}>
            {e('selectAll')}
          </Checkbox>
        )}
      </Flex>
      {rows.length
        ? (
          <div className='export-bookmarks-list overscroll-y'>
            {rows.map(bookmark => {
              const type = getBookmarkType(bookmark)
              const meta = bookmarkMeta(bookmark)
              const label = bookmark.title || bookmark.host || bookmark.url || bookmark.id
              return (
                // the row toggles, the checkbox stops the click from bubbling
                // so it does not toggle twice
                <Flex
                  align='center'
                  gap={8}
                  className='export-bookmarks-item pointer'
                  key={bookmark.id}
                  onClick={() => toggle(bookmark.id)}
                >
                  <Checkbox
                    checked={selected.has(bookmark.id)}
                    onChange={() => toggle(bookmark.id)}
                    onClick={evt => evt.stopPropagation()}
                  />
                  <Flex vertical className='export-bookmarks-text'>
                    <span className='elli'>{label}</span>
                    {meta && (
                      <span className='export-bookmarks-hint elli'>{meta}</span>
                    )}
                  </Flex>
                  <Tag className='export-bookmarks-tag'>{type}</Tag>
                  {(!!bookmark.privateKey || !!bookmark.privateKeyPath) && (
                    <Tag color='gold' className='export-bookmarks-tag'>
                      {e('privateKey')}
                    </Tag>
                  )}
                  {!!bookmark.password && (
                    <Tag color='gold' className='export-bookmarks-tag'>
                      {e('password')}
                    </Tag>
                  )}
                </Flex>
              )
            })}
          </div>
          )
        : <Empty description={e('notFoundContent')} />}
      <div className='export-bookmarks-hint export-bookmarks-warn mg1t'>
        {e('exportDataWarn')}
      </div>
    </Modal>
  )
}

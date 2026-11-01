/**
 * "This widget offers bookmarks" block.
 *
 * Shown when an action result of a config-mode widget carries `bookmarks`:
 *   { bookmarks: [bookmark], bookmarkGroups?: [group] }
 * the same shape as electerm's own bookmark export, so a widget can convert
 * other tools' session files. Like `aiConfig` it is only an offer: the list
 * is shown and nothing is added until the user presses the button, then it
 * goes through the regular bookmark import (tree-list/bookmark-upload.js).
 */
import React, { useState } from 'react'
import { Button, Table, Tag } from 'antd'
import { isPlainObject } from 'lodash-es'
import { bookmarkUpload } from '../tree-list/bookmark-upload'
import { fixBookmarkData } from '../bookmark-form/fix-bookmark-default'

const columns = [
  { title: 'Title', dataIndex: 'title', ellipsis: true },
  { title: 'Type', dataIndex: 'type', width: 70 },
  { title: 'Host', dataIndex: 'host', ellipsis: true },
  { title: 'User', dataIndex: 'username', ellipsis: true }
]

export function getBookmarkOffer (offer) {
  if (!isPlainObject(offer) || !Array.isArray(offer.bookmarks)) {
    return null
  }
  return {
    // the defaults the bookmark form would set (port, auth type, ...)
    bookmarks: offer.bookmarks.filter(isPlainObject).map(fixBookmarkData),
    // groups refer to each other and to bookmarks by id
    bookmarkGroups: Array.isArray(offer.bookmarkGroups)
      ? offer.bookmarkGroups.filter(g => isPlainObject(g) && g.id)
      : []
  }
}

export default function WidgetBookmarks ({ offer }) {
  const [state, setState] = useState('')
  const data = getBookmarkOffer(offer)
  if (!data || !data.bookmarks.length) {
    return null
  }
  const run = async () => {
    setState('busy')
    try {
      await bookmarkUpload({ fileContent: JSON.stringify(data) })
      setState('done')
    } catch (err) {
      console.error('widget bookmarks import failed', err)
      setState('')
    }
  }
  return (
    <div className='wac'>
      <div className='wac-head'>
        <span className='wac-title'>
          Import {data.bookmarks.length} bookmarks
          {data.bookmarkGroups.length ? ` in ${data.bookmarkGroups.length} groups` : ''}?
        </span>
        <Button
          type='primary'
          size='small'
          loading={state === 'busy'}
          disabled={state === 'done'}
          onClick={run}
        >
          {state === 'done' ? 'Imported' : 'Import bookmarks'}
        </Button>
        {state === 'done' ? <Tag color='green'>imported</Tag> : null}
      </div>
      <p className='wac-desc'>
        This widget offers these bookmarks. Nothing is added until you press the button.
      </p>
      <Table
        className='mg1b'
        size='small'
        rowKey={(row, i) => row.id || i}
        pagination={data.bookmarks.length > 10 ? { pageSize: 10 } : false}
        dataSource={data.bookmarks}
        columns={columns}
      />
    </div>
  )
}

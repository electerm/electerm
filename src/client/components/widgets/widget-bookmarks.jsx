/**
 * "This widget offers bookmarks" block.
 *
 * Shown when an action result of a config-mode widget carries `bookmarks`:
 *
 *   { bookmarks: { bookmarks: [bookmark], bookmarkGroups?: [group] } }
 *
 * — the same shape as electerm's own bookmark export, so a widget can convert
 * other tools' session files. A bare `bookmarks: [bookmark]` array is accepted
 * too (with `bookmarkGroups` beside it in the result), because that is what a
 * widget author writes first, and a silently empty block is a bad way to learn
 * otherwise.
 *
 * Like `aiConfig` it is only an offer: the list is shown and nothing is added
 * until the user presses the button, then it goes through the regular bookmark
 * import (tree-list/bookmark-upload.js), so it follows the same rules as a file
 * import — including "a category id that already exists is merged into, not
 * duplicated".
 *
 * The block is keyed by the offer it belongs to: results are stacked in the
 * config-mode panel (a row button pushes a new one), and the next offer must
 * not inherit the previous one's "imported" state.
 */
import React, { useMemo, useState } from 'react'
import { Alert, Button, Table, Tag } from 'antd'
import { isPlainObject } from 'lodash-es'
import { bookmarkUpload } from '../tree-list/bookmark-upload'
import { fixBookmarkData } from '../bookmark-form/fix-bookmark-default'
import { widgetRowKey } from './row-key'

const e = window.translate

// what makes a bookmark carry a secret: the list below is the user's only
// chance to notice before it lands in their bookmark store. A key path counts:
// the bookmark authenticates with whatever that file holds.
const CREDENTIAL_FIELDS = ['password', 'passphrase', 'privateKey', 'privateKeyPath']

function normalize (bookmarks, bookmarkGroups) {
  // the defaults the bookmark form would set (port, auth type, ...)
  const list = bookmarks.filter(isPlainObject).map(fixBookmarkData)
  if (!list.length) {
    return null
  }
  return {
    bookmarks: list,
    // groups refer to each other and to bookmarks by id. A category is named by
    // `title`: a widget that writes `name` (the natural guess, and what the
    // bookmark form does not use) would otherwise import a title-less category
    // the sidebar renders blank
    bookmarkGroups: bookmarkGroups
      .filter(g => isPlainObject(g) && g.id)
      .map(g => g.title ? g : { ...g, title: g.name || '' })
  }
}

export function getBookmarkOffer (offer, extraGroups) {
  if (Array.isArray(offer)) {
    return normalize(offer, Array.isArray(extraGroups) ? extraGroups : [])
  }
  if (!isPlainObject(offer) || !Array.isArray(offer.bookmarks)) {
    return null
  }
  return normalize(
    offer.bookmarks,
    Array.isArray(offer.bookmarkGroups) ? offer.bookmarkGroups : []
  )
}

function addressOf (row) {
  if (row.host) {
    return row.port ? `${row.host}:${row.port}` : row.host
  }
  // web bookmarks use url, serial ones use path, local ones a folder
  return row.url || row.path || row.startDirectoryLocal || ''
}

// built per render: window.translate is not guaranteed to be ready when the
// module is evaluated
function columns () {
  return [
    { title: e('title'), dataIndex: 'title', ellipsis: true },
    { title: e('type'), dataIndex: 'type', width: 70 },
    {
      title: e('host'),
      key: 'address',
      ellipsis: true,
      render: (_, row) => <span title={addressOf(row)}>{addressOf(row)}</span>
    },
    {
      // ftp bookmarks call it `user`, every other type `username`
      title: e('username'),
      key: 'username',
      ellipsis: true,
      render: (_, row) => row.username || row.user || ''
    }
  ]
}

function offerFacts (offer) {
  const secret = offer.bookmarks.filter(
    bookmark => CREDENTIAL_FIELDS.some(field => !!bookmark[field])
  ).length
  // bookmarkUpload merges into the existing category of the same id
  const existing = new Set((window.store.bookmarkGroups || []).map(g => g.id))
  const merged = offer.bookmarkGroups.filter(
    group => existing.has(group.id)
  ).length
  return { secret, merged }
}

export default function WidgetBookmarks ({ offer }) {
  // `run` remembers which offer its state belongs to, so a stacked result
  // starts clean instead of claiming an import that belongs to another one
  const [run, setRun] = useState(null)
  const facts = useMemo(() => (offer ? offerFacts(offer) : null), [offer])
  if (!offer || !facts) {
    return null
  }
  const current = run && run.offer === offer ? run : null
  const status = current ? current.status : ''
  const total = offer.bookmarks.length
  const groups = offer.bookmarkGroups.length
  const runImport = async () => {
    setRun({ offer, status: 'busy' })
    // the returned value, not the absence of a throw: bookmarkUpload reports a
    // file it could not parse, a cancelled task and a busy importer through it
    const res = await bookmarkUpload({ fileContent: JSON.stringify(offer) })
    if (res && res.ok) {
      setRun({ offer, status: 'done' })
      return
    }
    setRun({
      offer,
      status: 'error',
      cancelled: !!(res && res.cancelled),
      error: res && res.error
    })
  }
  return (
    <div className='wac wbb'>
      <div className='wac-head'>
        <span className='wac-title'>
          {total} {e('bookmarks')}
          {groups ? ` · ${groups} ${e('bookmarkCategory')}` : ''}
        </span>
        <Button
          type='primary'
          size='small'
          loading={status === 'busy'}
          disabled={status === 'done'}
          onClick={runImport}
        >
          {status === 'done' ? 'Imported' : e('import')}
        </Button>
      </div>
      <p className='wac-desc'>
        This widget offers these bookmarks. Nothing is added until you press the button.
      </p>
      <div className='wac-rows'>
        {facts.merged > 0 && (
          <div className='wac-row'>
            <span className='wac-label'>{e('merge')}</span>
            <span className='wac-value'>{facts.merged}</span>
          </div>
        )}
        {facts.secret > 0 && (
          <div className='wac-row'>
            <span className='wac-label'>{e('password')} / {e('privateKey')}</span>
            <span className='wac-value'>
              <Tag color='orange'>{facts.secret}</Tag>
            </span>
          </div>
        )}
      </div>
      {status === 'error' && (
        <Alert
          type='error'
          showIcon
          className='mg1b'
          title={current.cancelled ? e('cancel') : e('error')}
          description={current.error && current.error.message}
        />
      )}
      <Table
        size='small'
        rowKey={widgetRowKey}
        pagination={total > 10 ? { pageSize: 10 } : false}
        dataSource={offer.bookmarks}
        columns={columns()}
      />
    </div>
  )
}

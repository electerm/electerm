/**
 * Sync data comparison component
 * Shows simple diff suggestions
 */

import { useState, useEffect } from 'react'
import { Spin } from 'antd'

const e = window.translate

export default function SyncDataCompare (props) {
  const { store } = window
  const { syncType } = props
  const [loading, setLoading] = useState(false)
  const [comparison, setComparison] = useState(null)

  useEffect(() => {
    loadComparison()
  }, [syncType])

  async function loadComparison () {
    setLoading(true)
    try {
      const result = await store.previewServerDataWithCompare(syncType)
      setComparison(result)
    } catch (err) {
      console.error('Failed to load comparison:', err)
    }
    setLoading(false)
  }

  if (!comparison) {
    return null
  }

  const { comparison: comp } = comparison

  // Filter only items with differences
  const diffs = comp.filter(item => item.onlyLocal > 0 || item.onlyServer > 0)

  if (diffs.length === 0) {
    return (
      <p className='mg1t sync-diff-text'>
        {e('dataInSync') || 'Data in sync'}
      </p>
    )
  }

  const nameMap = {
    bookmarks: e('bookmarks') || 'Bookmarks',
    bookmarkGroups: 'Bookmark Groups',
    terminalThemes: e('terminalThemes') || 'Terminal Themes',
    quickCommands: e('quickCommands') || 'Quick Commands',
    profiles: e('profiles') || 'Profiles',
    addressBookmarks: e('addressBookmarks') || 'Address Bookmarks',
    workspaces: e('workspaces') || 'Workspaces'
  }

  const lines = diffs.map(item => {
    const displayName = nameMap[item.name] || item.name
    const localCount = item.localCount
    const serverCount = item.serverCount
    const diff = serverCount - localCount
    let action = ''
    if (diff > 0) {
      action = e('download') || 'download'
    } else if (diff < 0) {
      action = e('upload') || 'upload'
    }
    return {
      text: `${e('remote') || 'remote'}: ${serverCount} ${displayName}, ${e('local') || 'local'}: ${localCount} ${displayName}`,
      action
    }
  })

  return (
    <div className='sync-data-compare mg1t mg2b'>
      <Spin spinning={loading}>
        <div className='sync-diff-text'>
          {lines.map((line, i) => (
            <p key={i} className='mg0'>
              {line.text}
              {line.action && (
                <span className='sync-suggest-action'> {'->'} {line.action} ?</span>
              )}
            </p>
          ))}
        </div>
      </Spin>
    </div>
  )
}

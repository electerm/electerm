/**
 * AI bookmark history component
 */
import { useState, useEffect } from 'react'
import { Space, Tag, Tooltip } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { getItemJSON, setItemJSON } from '../../common/safe-local-storage'

const STORAGE_KEY = 'ai_bookmark_history'
const MAX_HISTORY = 20
const e = window.translate

export function getHistory () {
  return getItemJSON(STORAGE_KEY, [])
}

export function addHistoryItem (text) {
  if (!text || !text.trim()) return
  const item = text.trim()
  let history = getHistory()
  // Remove if it already exists to put it at the beginning
  history = history.filter(h => h !== item)
  history.unshift(item)
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY)
  }
  setItemJSON(STORAGE_KEY, history)

  // Custom event to trigger update
  window.dispatchEvent(new Event('ai-bookmark-history-update'))
}

export default function AIBookmarkHistory (props) {
  const { onSelect } = props
  const [history, setHistory] = useState([])

  const loadHistory = () => {
    setHistory(getHistory())
  }

  useEffect(() => {
    loadHistory()
    window.addEventListener('ai-bookmark-history-update', loadHistory)
    return () => {
      window.removeEventListener('ai-bookmark-history-update', loadHistory)
    }
  }, [])

  const handleDelete = (item, event) => {
    event.preventDefault()
    event.stopPropagation()
    const newHistory = history.filter(h => h !== item)
    setHistory(newHistory)
    setItemJSON(STORAGE_KEY, newHistory)
  }

  if (!history.length) {
    return null
  }

  return (
    <div className='ai-bookmark-history pd1b'>
      <div className='pd1b text-muted'>
        <HistoryOutlined className='mg1r' />
        <span className='mg1r'>{e('history') || 'History'}:</span>
      </div>
      <Space size={[8, 8]} wrap>
        {history.map((item) => {
          const isLong = item.length > 50
          const displayItem = isLong ? `${item.slice(0, 50)}...` : item
          const tagElem = (
            <Tag
              key={item}
              closable
              onClose={(event) => handleDelete(item, event)}
              onClick={() => onSelect(item)}
              className='pointer'
            >
              {displayItem}
            </Tag>
          )
          return isLong
            ? (
              <Tooltip title={item} key={item}>
                {tagElem}
              </Tooltip>
              )
            : (
                tagElem
              )
        })}
      </Space>
    </div>
  )
}

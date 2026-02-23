/**
 * Generic AI history component
 */
import { useState, useEffect } from 'react'
import { Space } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { getItemJSON, setItemJSON } from '../../common/safe-local-storage'
import AiHistoryItem from './ai-history-item'

const MAX_HISTORY = 20
const e = window.translate

export function getHistory (storageKey) {
  return getItemJSON(storageKey, [])
}

export function addHistoryItem (storageKey, itemData, eventName) {
  if (!itemData) return

  // Standardize the check: if itemData is an object, we serialize it
  // But wait, the comparison should be stable. We can rely on a unique identifier
  // or a stringified version to avoid duplicates.
  let history = getHistory(storageKey)
  const itemStr = typeof itemData === 'string' ? itemData.trim() : JSON.stringify(itemData)

  if (!itemStr) return

  history = history.filter(h => {
    const hStr = typeof h === 'string' ? h.trim() : JSON.stringify(h)
    return hStr !== itemStr
  })

  // use original data structure to save
  const dataToSave = typeof itemData === 'string' ? itemData.trim() : itemData

  history.unshift(dataToSave)
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY)
  }
  setItemJSON(storageKey, history)

  // Custom event to trigger update
  if (eventName) {
    window.dispatchEvent(new Event(eventName))
  }
}

export default function AiHistory (props) {
  const { onSelect, storageKey, eventName, renderItem } = props
  const [history, setHistory] = useState([])

  const loadHistory = () => {
    setHistory(getHistory(storageKey))
  }

  useEffect(() => {
    loadHistory()
    if (eventName) {
      window.addEventListener(eventName, loadHistory)
      return () => {
        window.removeEventListener(eventName, loadHistory)
      }
    }
  }, [storageKey, eventName])

  const handleDelete = (item, event) => {
    event.preventDefault()
    event.stopPropagation()
    const itemStr = typeof item === 'string' ? item : JSON.stringify(item)
    const newHistory = history.filter(h => {
      const hStr = typeof h === 'string' ? h : JSON.stringify(h)
      return hStr !== itemStr
    })
    setHistory(newHistory)
    setItemJSON(storageKey, newHistory)
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
        {history.map((item, index) => {
          const keyStr = typeof item === 'string' ? item : JSON.stringify(item)
          return (
            <AiHistoryItem
              key={keyStr + index}
              item={item}
              onSelect={onSelect}
              onDelete={handleDelete}
              renderItem={renderItem}
            />
          )
        })}
      </Space>
    </div>
  )
}

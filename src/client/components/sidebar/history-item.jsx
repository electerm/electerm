import React, { useCallback, useEffect, useRef } from 'react'
import createTitle, { createTitleWithTag } from '../../common/create-title'
import { DeleteOutlined } from '@ant-design/icons'

export default function HistoryItem (props) {
  const { store } = window
  const {
    item,
    index
  } = props
  const timeoutRef = useRef(null)

  const handleClick = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      store.onSelectHistory(item.tab)
    }, 10)
  }, [item.tab])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  function handleDelete (e) {
    e.stopPropagation()
    store.history.splice(index, 1)
  }
  const title = createTitleWithTag(item.tab)
  const tt = createTitle(item.tab)
  return (
    <div
      className='item-list-unit'
      title={tt}
      onClick={handleClick}
    >
      <div className='elli pd1y pd2x'>
        {title}
      </div>
      <DeleteOutlined
        className='list-item-edit'
        onClick={handleDelete}
      />
    </div>
  )
}

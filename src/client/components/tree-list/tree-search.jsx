import React, { useState, memo, useCallback, useEffect, useRef } from 'react'
import { debounce } from 'lodash-es'
import { Space, Button } from 'antd'
import { SortAscendingOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons'
import Search from '../common/search'
import runIdle from '../../common/run-idle'

function cycleSort (currentField, currentDir, clickedField) {
  if (currentField === clickedField) {
    if (currentDir === 'asc') {
      return { field: clickedField, dir: 'desc' }
    }
    if (currentDir === 'desc') {
      return null
    }
  }
  return { field: clickedField, dir: 'asc' }
}

export default memo(function TreeSearchComponent ({
  onSearch,
  keyword,
  autoFocus,
  onKeyDown,
  sort,
  onSortChange
}) {
  const [searchTerm, setSearchTerm] = useState(keyword)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const performSearch = debounce((term) => {
    runIdle(() => {
      onSearch(term)
    })
  })

  const handleChange = (e) => {
    const term = e.target.value
    setSearchTerm(term)
    performSearch(term)
  }

  const handleKeyDown = (e) => {
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  const handleSortClick = useCallback((field) => {
    const next = cycleSort(sort?.field, sort?.dir, field)
    onSortChange(next)
  }, [sort, onSortChange])

  const handleTriggerClick = () => {
    setOpen(v => !v)
  }

  const handleItemClick = (field) => {
    handleSortClick(field)
  }

  const isSortActive = !!sort?.field

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div className={`tree-sort-wrap iblock${open ? ' open' : ''}`} ref={wrapRef}>
      <Space.Compact className='width-100'>
        <Search
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          value={searchTerm}
          allowClear
          autoFocus={autoFocus}
        />
        <Button
          className={`tree-sort-trigger pointer${isSortActive ? ' active' : ''}`}
          onClick={handleTriggerClick}
          icon={<SortAscendingOutlined />}
        />
      </Space.Compact>
      <div className='tree-sort-dropdown'>
        {['title', 'host'].map(field => {
          const isActive = sort?.field === field
          const isAsc = isActive && sort?.dir === 'asc'
          const isDesc = isActive && sort?.dir === 'desc'
          const cap = window.translate(field)
          return (
            <div
              key={field}
              className={`tree-sort-popover-item${isActive ? ' active' : ''}`}
              onClick={() => handleItemClick(field)}
            >
              {isDesc
                ? <CaretDownOutlined />
                : <CaretUpOutlined className={isAsc ? '' : 'hidden'} />}
              {cap}
            </div>
          )
        })}
      </div>
    </div>
  )
})

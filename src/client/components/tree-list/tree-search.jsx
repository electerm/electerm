import React, { useState, memo } from 'react'
import { debounce } from 'lodash-es'
import Search from '../common/search'
import runIdle from '../../common/run-idle'

export default memo(function TreeSearchComponent ({ onSearch, keyword, autoFocus, onKeyDown }) {
  const [searchTerm, setSearchTerm] = useState(keyword)

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

  return (
    <Search
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      value={searchTerm}
      allowClear
      autoFocus={autoFocus}
    />
  )
})

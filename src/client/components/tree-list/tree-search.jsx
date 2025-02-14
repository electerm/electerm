import React, { useState, memo } from 'react'
import { debounce } from 'lodash-es'
import Search from '../common/search'
import runIdle from '../../common/run-idle'

export default memo(function TreeSearchComponent ({ onSearch, keyword }) {
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

  return (
    <Search
      onChange={handleChange}
      value={searchTerm}
      allowClear
    />
  )
})

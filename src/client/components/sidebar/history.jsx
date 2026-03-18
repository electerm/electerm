/**
 * history select
 */

import React, { useState, useEffect } from 'react'
import { auto } from 'manate/react'
import { Switch } from 'antd'
import { UnorderedListOutlined } from '@ant-design/icons'
import HistoryItem from './history-item'
import { getItemJSON, setItemJSON } from '../../common/safe-local-storage.js'

const SORT_BY_FREQ_KEY = 'electerm-history-sort-by-frequency'

export default auto(function HistoryPanel (props) {
  const { store } = window
  const [sortByFrequency, setSortByFrequency] = useState(() => {
    return getItemJSON(SORT_BY_FREQ_KEY, false)
  })

  useEffect(() => {
    setItemJSON(SORT_BY_FREQ_KEY, sortByFrequency)
  }, [sortByFrequency])

  const {
    history
  } = store
  let arr = store.config.disableConnectionHistory ? [] : history
  if (sortByFrequency) {
    arr = arr.sort((a, b) => { return b.count - a.count })
  }

  const handleSortByFrequencyChange = (checked) => {
    setSortByFrequency(checked)
  }

  const handleClearHistory = () => {
    store.clearHistory()
  }
  const e = window.translate
  const switchProps = {
    checkedChildren: e('sortByFrequency'),
    unCheckedChildren: e('sortByFrequency'),
    checked: sortByFrequency,
    onChange: handleSortByFrequencyChange,
    size: 'small'
  }
  const clearIconProps = {
    className: 'history-clear-icon pointer clear-ai-icon icon-hover',
    title: window.translate('clear'),
    onClick: handleClearHistory
  }
  return (
    <div
      className='sidebar-panel-history'
    >
      <div className='history-header pd2x pd2b'>
        <Switch
          {...switchProps}
        />
        <UnorderedListOutlined
          {...clearIconProps}
        />
      </div>
      <div className='history-body'>
        {
          arr.map((item, i) => {
            return (
              <HistoryItem
                key={item.id}
                item={item}
              />
            )
          })
        }
      </div>
    </div>
  )
})

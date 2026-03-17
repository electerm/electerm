/**
 * cmd history trigger button with popover
 */

import { useState, useEffect } from 'react'
import { Button, Empty, Popover, Switch } from 'antd'
import { auto } from 'manate/react'
import { copy } from '../../common/clipboard'
import { HistoryOutlined, DeleteOutlined, CopyOutlined, UnorderedListOutlined } from '@ant-design/icons'
import InputAutoFocus from '../common/input-auto-focus'
import { getItemJSON, setItemJSON } from '../../common/safe-local-storage'
import './cmd-history.styl'

const e = window.translate
const SORT_BY_FREQ_KEY = 'electerm-cmd-history-sort-by-frequency'

export default auto(function CmdHistory (props) {
  const [keyword, setKeyword] = useState('')
  const [sortByFrequency, setSortByFrequency] = useState(() => {
    return getItemJSON(SORT_BY_FREQ_KEY, false)
  })
  const { terminalCommandHistory } = props.store

  useEffect(() => {
    setItemJSON(SORT_BY_FREQ_KEY, sortByFrequency)
  }, [sortByFrequency])

  function handleRunCommand (cmd) {
    window.store.runCmdFromHistory(cmd)
  }

  function handleDeleteCommand (cmd, ev) {
    ev.stopPropagation()
    terminalCommandHistory.delete(cmd)
  }

  function handleCopyCommand (cmd, ev) {
    ev.stopPropagation()
    copy(cmd)
  }

  function handleClearAll () {
    window.store.clearAllCmdHistory()
  }

  function filterArray (array, keyword) {
    if (!keyword) {
      return array
    }
    return array.filter(item => item.cmd.toLowerCase().includes(keyword.toLowerCase()))
  }

  function handleChange (e) {
    setKeyword(e.target.value)
  }

  const historyArray = Array.from(terminalCommandHistory || [])
    .map(([cmd, info]) => ({ cmd, ...info }))
    .reverse()

  let filtered = filterArray(historyArray, keyword)

  if (sortByFrequency) {
    filtered = filtered.sort((a, b) => b.count - a.count)
  }

  const handleSortByFrequencyChange = (checked) => {
    setSortByFrequency(checked)
  }

  const renderList = () => {
    if (filtered.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={e('noData')}
        />
      )
    }
    return filtered.map((item, index) => (
      <div
        key={index}
        className='cmd-history-item'
        onClick={() => handleRunCommand(item.cmd)}
      >
        <span className='cmd-history-item-text' title={item.cmd}>{item.cmd}</span>
        <div className='cmd-history-item-actions'>
          <span className='cmd-history-item-count' title={e('count') + ': ' + item.count}>
            {item.count}
          </span>
          <Button
            type='text'
            size='small'
            icon={<CopyOutlined />}
            className='cmd-history-item-copy'
            onClick={(ev) => handleCopyCommand(item.cmd, ev)}
          />
          <Button
            type='text'
            size='small'
            icon={<DeleteOutlined />}
            className='cmd-history-item-delete'
            onClick={(ev) => handleDeleteCommand(item.cmd, ev)}
          />
        </div>
      </div>
    ))
  }

  const content = (
    <div className='cmd-history-popover-content pd2'>
      <div className='cmd-history-search pd2b'>
        <InputAutoFocus
          value={keyword}
          onChange={handleChange}
          placeholder={e('search')}
          className='cmd-history-search-input'
          allowClear
        />
      </div>
      <div className='cmd-history-header pd2b'>
        <Switch
          checkedChildren={e('sortByFrequency')}
          unCheckedChildren={e('sortByFrequency')}
          checked={sortByFrequency}
          onChange={handleSortByFrequencyChange}
          size='small'
        />
        <UnorderedListOutlined
          className='cmd-history-clear-icon pointer clear-ai-icon icon-hover'
          title={e('clear')}
          onClick={handleClearAll}
        />
      </div>
      <div className='cmd-history-list'>
        {renderList()}
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger='click'
      placement='topLeft'
    >
      <Button
        size='small'
        type='text'
        icon={<HistoryOutlined />}
      />
    </Popover>
  )
})

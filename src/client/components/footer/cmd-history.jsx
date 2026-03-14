/**
 * cmd history trigger button with popover
 */

import { useState } from 'react'
import { Button, Empty, Popover } from 'antd'
import { auto } from 'manate/react'
import { copy } from '../../common/clipboard'
import { HistoryOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import InputAutoFocus from '../common/input-auto-focus'
import './cmd-history.styl'

const e = window.translate

export default auto(function CmdHistory (props) {
  const [keyword, setKeyword] = useState('')
  const { terminalCommandHistory } = props.store

  function handleRunCommand (cmd) {
    window.store.runQuickCommand(cmd)
  }

  function handleDeleteCommand (cmd, ev) {
    ev.stopPropagation()
    terminalCommandHistory.delete(cmd)
  }

  function handleCopyCommand (cmd, ev) {
    ev.stopPropagation()
    copy(cmd)
  }

  function filterArray (array, keyword) {
    if (!keyword) {
      return array
    }
    return array.filter(cmd => cmd.toLowerCase().includes(keyword.toLowerCase()))
  }

  function handleChange (e) {
    setKeyword(e.target.value)
  }

  const historyArray = Array.from(terminalCommandHistory || []).reverse()
  const filtered = filterArray(historyArray, keyword)

  const renderList = () => {
    if (filtered.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={e('noData')}
        />
      )
    }
    return filtered.map((cmd, index) => (
      <div
        key={index}
        className='cmd-history-item'
        onClick={() => handleRunCommand(cmd)}
      >
        <span className='cmd-history-item-text' title={cmd}>{cmd}</span>
        <div className='cmd-history-item-actions'>
          <Button
            type='text'
            size='small'
            icon={<CopyOutlined />}
            className='cmd-history-item-copy'
            onClick={(ev) => handleCopyCommand(cmd, ev)}
          />
          <Button
            type='text'
            size='small'
            icon={<DeleteOutlined />}
            className='cmd-history-item-delete'
            onClick={(ev) => handleDeleteCommand(cmd, ev)}
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

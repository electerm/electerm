/**
 * cmd history trigger button with popover
 */

import { useState, useEffect } from 'react'
import { Button, Empty, Popover, Dropdown } from 'antd'
import { auto } from 'manate/react'
import SwitchLabel from '../common/switch'
import { copy } from '../../common/clipboard'
import {
  HistoryOutlined,
  DeleteOutlined,
  CopyOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  PlusOutlined,
  CodeOutlined
} from '@ant-design/icons'
import InputAutoFocus from '../common/input-auto-focus'
import { getItemJSON, setItemJSON } from '../../common/safe-local-storage'
import QuickCommandCreateModal from '../quick-commands/quick-command-create-modal'
import MultiTabRunModal from './multi-tab-run-modal'
import classNames from 'classnames'
import './cmd-history.styl'

const e = window.translate
const SORT_BY_FREQ_KEY = 'electerm-cmd-history-sort-by-frequency'

export default auto(function CmdHistory (props) {
  const [keyword, setKeyword] = useState('')
  const [sortByFrequency, setSortByFrequency] = useState(() => {
    return getItemJSON(SORT_BY_FREQ_KEY, false)
  })
  // cmd of the item whose action menu is open / being acted on
  const [menuOpenCmd, setMenuOpenCmd] = useState('')
  const [quickCommandCmd, setQuickCommandCmd] = useState('')
  const [multiTabCmd, setMultiTabCmd] = useState('')
  const { terminalCommandHistory } = props.store

  useEffect(() => {
    setItemJSON(SORT_BY_FREQ_KEY, sortByFrequency)
  }, [sortByFrequency])

  function handleRunCommand (cmd) {
    window.store.runCmdFromHistory(cmd)
  }

  function handleCopyCommand (cmd, ev) {
    ev.stopPropagation()
    copy(cmd)
  }

  function handleClearAll () {
    window.store.clearAllCmdHistory()
  }

  function handleMenuAction (key, cmd) {
    if (key === 'delete') {
      window.store.deleteCmdHistory(cmd)
    } else if (key === 'quickCommand') {
      setQuickCommandCmd(cmd)
    } else if (key === 'multiTab') {
      window.store.filterBatchInputSelectedTabIds()
      setMultiTabCmd(cmd)
    }
  }

  function getMenuProps (cmd) {
    return {
      items: [
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: e('del'),
          danger: true
        },
        {
          key: 'quickCommand',
          icon: <PlusOutlined />,
          label: e('addQuickCommands')
        },
        {
          key: 'multiTab',
          icon: <CodeOutlined />,
          label: e('runInAllTerminals')
        }
      ],
      onClick: ({ key, domEvent }) => {
        // the menu renders in a portal but React events still bubble through
        // the row, which would run the command
        domEvent.stopPropagation()
        handleMenuAction(key, cmd)
      }
    }
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

  const historyArray = (terminalCommandHistory || []).slice().reverse()

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
    return filtered.map((item, index) => {
      const cls = classNames(
        'cmd-history-item',
        { 'menu-open': menuOpenCmd === item.cmd }
      )
      return (
        <div
          key={index}
          className={cls}
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
            <Dropdown
              menu={getMenuProps(item.cmd)}
              trigger={['click']}
              onOpenChange={(open) => setMenuOpenCmd(open ? item.cmd : '')}
            >
              <Button
                type='text'
                size='small'
                icon={<MoreOutlined />}
                className='cmd-history-item-more'
                onClick={(ev) => ev.stopPropagation()}
              />
            </Dropdown>
          </div>
        </div>
      )
    })
  }

  function renderHeader () {
    if (!historyArray.length) {
      return null
    }
    return (
      <div className='cmd-history-header pd2b'>
        <div className='cmd-history-sort'>
          <SwitchLabel
            checked={sortByFrequency}
            onChange={handleSortByFrequencyChange}
            size='small'
            label={e('sortByFrequency')}
          />
        </div>
        <UnorderedListOutlined
          className='cmd-history-clear-icon pointer clear-ai-icon icon-hover'
          title={e('clear')}
          onClick={handleClearAll}
        />
      </div>
    )
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
      {renderHeader()}
      <div className='cmd-history-list'>
        {renderList()}
      </div>
    </div>
  )

  return (
    <>
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
      {
        quickCommandCmd
          ? (
            <QuickCommandCreateModal
              key={quickCommandCmd}
              store={props.store}
              command={quickCommandCmd}
              onClose={() => setQuickCommandCmd('')}
            />
            )
          : null
      }
      {
        multiTabCmd
          ? (
            <MultiTabRunModal
              store={props.store}
              cmd={multiTabCmd}
              onClose={() => setMultiTabCmd('')}
            />
            )
          : null
      }
    </>
  )
})

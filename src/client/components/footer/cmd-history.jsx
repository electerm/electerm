/**
 * cmd history trigger button with popover
 */

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Button, Empty, Popover } from 'antd'
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
  // The item action menu is a part of this panel, not of the row it acts on:
  // the row's ⋯ icon only reports which command was picked and where that row
  // sits ({ cmd, top, rowTop }), and the panel renders the single menu for it.
  // A menu per row cannot be closed with the panel — the popover content stops
  // being re-rendered the moment the popover closes, so a per-row menu portaled
  // to the body is left floating on its own.
  const [menu, setMenu] = useState(null)
  const panelRef = useRef(null)
  const menuRef = useRef(null)
  const [quickCommandCmd, setQuickCommandCmd] = useState('')
  const [multiTabCmd, setMultiTabCmd] = useState('')
  const { terminalCommandHistory } = props.store

  useEffect(() => {
    setItemJSON(SORT_BY_FREQ_KEY, sortByFrequency)
  }, [sortByFrequency])

  // The menu hangs below its row, which for the last rows would put it past the
  // bottom of the window — the panel itself is not clipped, so lift the menu
  // above its row instead. The layout effect runs before paint, so the
  // correction is never visible.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el || !menu) {
      return
    }
    const rect = el.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 4) {
      const above = menu.rowTop - rect.height
      if (above !== menu.top) {
        setMenu({
          ...menu,
          top: above
        })
      }
    }
  }, [menu])

  function closeMenu () {
    setMenu(null)
  }

  function handleRunCommand (cmd) {
    closeMenu()
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
    closeMenu()
    if (key === 'delete') {
      window.store.deleteCmdHistory(cmd)
    } else if (key === 'quickCommand') {
      setQuickCommandCmd(cmd)
    } else if (key === 'multiTab') {
      window.store.filterBatchInputSelectedTabIds()
      setMultiTabCmd(cmd)
    }
  }

  function getMenuItems () {
    return [
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
    ]
  }

  // the ⋯ icon only reports the picked command and its position; the panel owns
  // the menu itself
  function handleToggleMenu (ev, cmd) {
    // the row would otherwise run the command
    ev.stopPropagation()
    if (menu && menu.cmd === cmd) {
      closeMenu()
      return
    }
    const row = ev.currentTarget.closest('.cmd-history-item')
    const panel = panelRef.current
    if (!row || !panel) {
      return
    }
    const rowRect = row.getBoundingClientRect()
    const panelTop = panel.getBoundingClientRect().top
    setMenu({
      cmd,
      // below the row by default, above it when there is no room left
      top: rowRect.bottom - panelTop,
      rowTop: rowRect.top - panelTop
    })
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

  // The menu is anchored to its row, and rc-trigger re-aligns it on every
  // scroll of the trigger's scrollable ancestors. The rows live in a 190px-tall
  // scrolling list, so a wheel over the list drags an open menu along with the
  // row — out of the popup and eventually off the screen, while the row it
  // belongs to is long gone. Close it instead: the menu is only meaningful next
  // to the row it was opened on.
  function handleListScroll () {
    if (menu) {
      closeMenu()
    }
  }

  // closing the popover hides the menu with it; dropping the selection too
  // keeps it from coming back on the next open
  function handlePopoverOpenChange (open) {
    if (!open) {
      closeMenu()
    }
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
        { 'menu-open': menu && menu.cmd === item.cmd }
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
            <Button
              type='text'
              size='small'
              icon={<MoreOutlined />}
              className={classNames(
                'cmd-history-item-more',
                { active: menu && menu.cmd === item.cmd }
              )}
              onClick={(ev) => handleToggleMenu(ev, item.cmd)}
            />
          </div>
        </div>
      )
    })
  }

  // the panel's own action menu: it renders inside the popover content, so it
  // is hidden and revealed with the panel instead of outliving it
  function renderItemMenu () {
    if (!menu) {
      return null
    }
    return (
      <div
        ref={menuRef}
        className='cmd-history-item-menu'
        style={{ top: `${menu.top}px` }}
        onClick={ev => ev.stopPropagation()}
      >
        {
          getMenuItems().map(item => (
            <div
              key={item.key}
              className={classNames(
                'cmd-history-menu-item',
                { danger: item.danger }
              )}
              onClick={() => handleMenuAction(item.key, menu.cmd)}
            >
              <span className='cmd-history-menu-icon'>{item.icon}</span>
              <span className='cmd-history-menu-label'>{item.label}</span>
            </div>
          ))
        }
      </div>
    )
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
    <div ref={panelRef} className='cmd-history-popover-content pd2'>
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
      <div className='cmd-history-list' onScroll={handleListScroll}>
        {renderList()}
      </div>
      {renderItemMenu()}
    </div>
  )

  return (
    <>
      <Popover
        content={content}
        trigger='click'
        placement='topLeft'
        onOpenChange={handlePopoverOpenChange}
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

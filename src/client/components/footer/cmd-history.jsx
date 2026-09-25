/**
 * cmd history panel with popover
 *
 * The panel has two homes: the footer popover (default) and the right side
 * panel. Which one it is in is a stored preference (store.cmdHistoryInRightPanel),
 * so the same component renders both — `inline` drops the trigger/popover and
 * lets the right panel's own container wrap the panel body.
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
  CodeOutlined,
  VerticalLeftOutlined,
  VerticalAlignBottomOutlined
} from '@ant-design/icons'
import InputAutoFocus from '../common/input-auto-focus'
import { getItemJSON, setItemJSON } from '../../common/safe-local-storage'
import QuickCommandCreateModal from '../quick-commands/quick-command-create-modal'
import MultiTabRunModal from './multi-tab-run-modal'
import { refsStatic } from '../common/ref'
import classNames from 'classnames'
import './cmd-history.styl'

const e = window.translate
const SORT_BY_FREQ_KEY = 'electerm-cmd-history-sort-by-frequency'

export default auto(function CmdHistory (props) {
  const { store, inline } = props
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
  // Footer mode only. The popover is controlled so that the trigger can be
  // repurposed (open the right panel instead, when the history lives there) and
  // so that "move back to footer" can open it again from the store.
  const [open, setOpen] = useState(false)
  const { terminalCommandHistory } = store

  useEffect(() => {
    setItemJSON(SORT_BY_FREQ_KEY, sortByFrequency)
  }, [sortByFrequency])

  // "move back to footer" happens in the right panel, which cannot reach this
  // component through props — it goes through the store, which needs a handle
  useEffect(() => {
    if (inline) {
      return
    }
    refsStatic.add('CmdHistory', {
      openPopover: () => setOpen(true)
    })
    return () => refsStatic.remove('CmdHistory')
  }, [inline])

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
  function handlePopoverOpenChange (nextOpen) {
    if (!nextOpen) {
      closeMenu()
      setOpen(false)
      return
    }
    // While the history lives in the right panel this trigger never opens the
    // popover: it opens and closes the right panel, exactly like the info and
    // AI triggers do (store.toggleCmdHistoryPanel).
    if (store.cmdHistoryInRightPanel) {
      window.store.toggleCmdHistoryPanel()
      return
    }
    setOpen(true)
  }

  // Dock the panel into the right side panel. The popover has to be closed on
  // the way out, or it would be left behind pointing at a panel that is no
  // longer in the footer.
  function handleMoveToRightPanel () {
    closeMenu()
    setOpen(false)
    window.store.moveCmdHistoryToRightPanel()
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

  // The two "move" icons are mirror images and sit in the same slot: the
  // popover offers to dock the panel into the right side panel, the docked
  // panel offers to hand it back to the footer popover. The glyphs are antd's
  // "align" pair — an arrow into a bar on the right, an arrow into a bar at the
  // bottom — so each points at the edge the panel is going to.
  // Note VerticalLeftOutlined is the one whose bar is on the right (arrow
  // pointing right); VerticalRightOutlined is its mirror and points left.
  function renderMoveIcon () {
    if (inline) {
      return (
        <VerticalAlignBottomOutlined
          className='cmd-history-move-icon pointer'
          title={e('moveToFooter')}
          onClick={() => window.store.moveCmdHistoryToFooter()}
        />
      )
    }
    return (
      <VerticalLeftOutlined
        className='cmd-history-move-icon pointer'
        title={e('moveToRightPanel')}
        onClick={handleMoveToRightPanel}
      />
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
        <div className='cmd-history-header-actions'>
          {renderMoveIcon()}
          <UnorderedListOutlined
            className='cmd-history-clear-icon pointer clear-ai-icon icon-hover'
            title={e('clear')}
            onClick={handleClearAll}
          />
        </div>
      </div>
    )
  }

  const content = (
    <div
      ref={panelRef}
      className={classNames(
        'cmd-history-popover-content',
        inline
          // docked: fill the right panel instead of sizing itself like a popup
          ? 'cmd-history-in-panel'
          : 'pd2'
      )}
    >
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

  // The modals are siblings of the panel, never children of the popover: the
  // content of a closed popover is no longer re-rendered, so a modal opened
  // from inside one could not be closed once the popover went away.
  const modals = (
    <>
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

  // docked in the right side panel: no trigger, no popover — the right panel
  // decides when this is on screen, via store.rightPanelTab
  if (inline) {
    if (store.rightPanelTab !== 'cmdHistory') {
      return null
    }
    return (
      <>
        {content}
        {modals}
      </>
    )
  }

  const rightPanelActive = store.rightPanelVisible &&
    store.rightPanelTab === 'cmdHistory'

  return (
    <>
      <Popover
        content={content}
        trigger='click'
        placement='topLeft'
        open={open}
        onOpenChange={handlePopoverOpenChange}
      >
        <Button
          size='small'
          type='text'
          className={classNames(
            'cmd-history-trigger',
            { active: rightPanelActive }
          )}
          icon={<HistoryOutlined />}
        />
      </Popover>
      {modals}
    </>
  )
})

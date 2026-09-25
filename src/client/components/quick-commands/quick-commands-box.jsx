/**
 * quick commands panel
 *
 * The panel has two homes: the floating footer box (default) and the right side
 * panel. Which one it is in is a stored preference
 * (store.quickCommandsInRightPanel), so the same component renders both —
 * `inline` drops the floating box and lets the right panel's own container wrap
 * the panel body.
 */

import { useState } from 'react'
import { auto } from 'manate/react'
import {
  quickCommandLabelsLsKey,
  pinnedQuickCommandBarKey
} from '../../common/constants'
import { sortBy, pick } from 'lodash-es'
import { Button, Input, Select, Space, Flex } from 'antd'
import * as ls from '../../common/safe-local-storage'
import CmdItem from './quick-command-item'
import {
  EditOutlined,
  CloseCircleOutlined,
  PushpinOutlined,
  VerticalLeftOutlined,
  VerticalAlignBottomOutlined
} from '@ant-design/icons'
import classNames from 'classnames'
import onDropFunc from './on-drop'
import { isDropAfterHalf, setDropIndicator, clearDropIndicator } from '../../common/drop-position'
import './qm.styl'

const e = window.translate
const addQuickCommands = 'addQuickCommands'
const { Option } = Select

export default auto(function QuickCommandsFooterBox (props) {
  const { store, inline } = props
  const [keyword, setKeyword] = useState('')
  const [label, setLabel] = useState(ls.getItem(quickCommandLabelsLsKey, ''))
  // read through the store so the panel re-renders on its own: it is rendered
  // in two different places (footer box and right panel), and only one of them
  // gets props from the layout
  const {
    openQuickCommandBar,
    pinnedQuickCommandBar,
    qmSortByFrequency,
    quickCommandsInRightPanel,
    inActiveTerminal,
    leftSidePanelWidth,
    leftSideBarWidth,
    openedSideBar,
    rightPanelVisible,
    rightPanelPinned,
    rightPanelWidth,
    isMobile
  } = pick(store, [
    'openQuickCommandBar',
    'pinnedQuickCommandBar',
    'qmSortByFrequency',
    'quickCommandsInRightPanel',
    'inActiveTerminal',
    'leftSidePanelWidth',
    'leftSideBarWidth',
    'openedSideBar',
    'rightPanelVisible',
    'rightPanelPinned',
    'rightPanelWidth',
    'isMobile'
  ])
  const all = store.currentQuickCommands
  const quickCommandTags = store.quickCommandTags

  function handleTogglePinned () {
    const current = !window.store.pinnedQuickCommandBar
    ls.setItem(pinnedQuickCommandBarKey, current ? 'y' : 'n')
    window.store.pinnedQuickCommandBar = current
  }

  async function handleSelect (id) {
    const {
      store
    } = window
    if (id === addQuickCommands) {
      store.handleOpenQuickCommandsSetting()
    } else {
      store.runQuickCommandItem(id)
    }
  }

  function handleClose () {
    ls.setItem(pinnedQuickCommandBarKey, 'n')
    window.store.pinnedQuickCommandBar = false
    window.store.openQuickCommandBar = false
  }

  function handleChange (e) {
    setKeyword(e.target.value)
  }

  function handleChangeLabels (v) {
    ls.setItem(quickCommandLabelsLsKey, v || '')
    setLabel(v)
  }

  // Dock the panel into the right side panel. The footer box unmounts on the
  // way out (it is gated on quickCommandsInRightPanel), so there is nothing to
  // clean up here — unlike the cmd history popover, which has to be closed.
  function handleMoveToRightPanel () {
    window.store.moveQuickCommandsToRightPanel()
  }

  function onDragOver (e) {
    e.preventDefault()
    const el = e.target.closest('.qm-item')
    if (el) {
      setDropIndicator(el, isDropAfterHalf(e, el))
    }
  }

  function onDragStart (e) {
    e.dataTransfer.setData('idDragged', e.target.getAttribute('data-id'))
  }

  function onDragEnter (e) {
    e.preventDefault()
    const el = e.target.closest('.qm-item')
    if (el) {
      setDropIndicator(el, isDropAfterHalf(e, el))
    }
  }

  function onDragLeave (e) {
    const el = e.target.closest('.qm-item')
    if (el) {
      clearDropIndicator(el)
    }
  }

  function onDrop (e) {
    const el = e.target.closest('.qm-item')
    if (el) {
      clearDropIndicator(el)
    }
    onDropFunc(e, '.qm-item')
  }

  function renderNoCmd () {
    return (
      <div className='pd1'>
        <Button
          type='primary'
          onClick={window.store.handleOpenQuickCommandsSetting}
        >
          {e(addQuickCommands)}
        </Button>
      </div>
    )
  }

  function renderItem (item) {
    return (
      <CmdItem
        item={item}
        key={item.id}
        onSelect={handleSelect}
        draggable={!qmSortByFrequency}
        handleDragOver={onDragOver}
        handleDragStart={onDragStart}
        handleDragEnter={onDragEnter}
        handleDragLeave={onDragLeave}
        handleDrop={onDrop}
      />
    )
  }

  function renderTag (tag) {
    return (
      <Option
        value={tag}
        key={'tag-' + tag}
      >
        {tag}
      </Option>
    )
  }

  function filterArray (array, keyword, label) {
    return array.filter(obj => {
      const nameMatches = !keyword ||
        obj.name.toLowerCase().includes(keyword) ||
        (obj.commands || []).some(cmd =>
          (cmd.command || '').toLowerCase().includes(keyword) ||
          (cmd.name || '').toLowerCase().includes(keyword)
        )
      const labelMatches = !label || (obj.labels || []).includes(label)
      return nameMatches && labelMatches
    })
  }

  // The two "move" icons are mirror images and sit in the same slot: the footer
  // box offers to dock the panel into the right side panel, the docked panel
  // offers to hand it back to the footer. Same glyph pair as the cmd history
  // panel (cmd-history.jsx), so the two panels read the same way.
  // Note VerticalLeftOutlined is the one whose bar is on the right (arrow
  // pointing right); VerticalAlignBottomOutlined points at the footer.
  function renderMoveIcon () {
    if (inline) {
      return (
        <VerticalAlignBottomOutlined
          className='qm-move-icon pointer'
          title={e('moveToFooter')}
          onClick={() => window.store.moveQuickCommandsToFooter()}
        />
      )
    }
    return (
      <VerticalLeftOutlined
        className='qm-move-icon pointer'
        title={e('moveToRightPanel')}
        onClick={handleMoveToRightPanel}
      />
    )
  }

  // Docked, the right panel owns the pin and the close button (both live in its
  // title bar), so the panel keeps only the actions that are about the quick
  // commands themselves. A pin left over from the footer is kept in the store
  // and comes back with the panel, so nothing is silently lost.
  function renderActions () {
    const tp = pinnedQuickCommandBar
      ? 'primary'
      : 'text'
    return (
      <div className='qm-panel-actions mg2l'>
        {renderMoveIcon()}
        <Space.Compact>
          {
            !inline && (
              <Button
                onClick={handleTogglePinned}
                icon={<PushpinOutlined />}
                type={tp}
              />
            )
          }
          <Button
            onClick={window.store.handleOpenQuickCommandsSetting}
            icon={<EditOutlined />}
          />
          {
            !inline && (
              <Button
                onClick={handleClose}
                icon={<CloseCircleOutlined />}
              />
            )
          }
        </Space.Compact>
      </div>
    )
  }

  const keyword0 = keyword.toLowerCase()
  const filtered = filterArray(all, keyword0, label)
  const sorted = qmSortByFrequency
    ? sortBy(filtered, (obj) => -(obj.clickCount || 0))
    : filtered
  const sprops = {
    value: label,
    onChange: handleChangeLabels,
    placeholder: e('labels'),
    className: 'qm-label-select',
    allowClear: true
  }
  const cls = classNames('qm-list-wrap')
  const type = qmSortByFrequency ? 'primary' : 'default'
  // Mirrors the footer's left offset. Mobile reserves nothing for the side
  // panel — it is a full-screen drawer there (store.leftSidePanelWidth returns
  // the viewport width), so adding it would push the popup off-screen.
  const w = openedSideBar && !isMobile
    ? leftSideBarWidth + leftSidePanelWidth
    : leftSideBarWidth
  // Keep the popup's horizontal extent in step with the footer (same `w`
  // expression above). A pinned right panel is a dock that reserves its width
  // in layout.jsx, so give that width up here too — otherwise the popup's right
  // end slides under the dock. Unpinned is an overlay and reserves nothing, and
  // mobile is excluded to match layout.jsx.
  const qmStyle = {
    left: w
  }
  if (rightPanelVisible && rightPanelPinned && !isMobile) {
    qmStyle.right = rightPanelWidth
  }
  const qmProps = {
    className: 'qm-wrap-tooltip',
    style: qmStyle
  }

  const content = (
    <div className='pd2'>
      <Flex justify='space-between' className='qm-flex'>
        <Input.Search
          value={keyword}
          onChange={handleChange}
          placeholder=''
          className='qm-search-input'
        />
        <Flex gap='small'>
          <Select
            {...sprops}
          >
            {quickCommandTags.map(
              renderTag
            )}
          </Select>
          <Button
            type={type}
            onClick={window.store.handleSortByFrequency}
          >
            {e('sortByFrequency')}
          </Button>
        </Flex>
        {renderActions()}
      </Flex>
      <div className={cls}>
        {sorted.map(renderItem)}
        {
          !sorted.length && renderNoCmd()
        }
      </div>
    </div>
  )

  // docked in the right side panel: no floating box, no pin/close of its own —
  // the right panel decides when this is on screen, via store.rightPanelTab
  if (inline) {
    if (store.rightPanelTab !== 'quickCommands') {
      return null
    }
    return (
      <div className='qm-panel-in-right-panel'>
        {content}
      </div>
    )
  }

  // Dormant while the panel is docked: the box would otherwise float over the
  // terminal with nothing to show for it, and a pin left on would keep
  // reserving the strip of height it occupies (see layout.jsx).
  if (
    quickCommandsInRightPanel ||
    (!openQuickCommandBar && !pinnedQuickCommandBar) ||
    !inActiveTerminal
  ) {
    return null
  }

  return (
    <div
      {...qmProps}
    >
      {content}
    </div>
  )
})

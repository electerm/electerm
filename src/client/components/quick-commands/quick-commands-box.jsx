/**
 * quick commands footer selection wrap
 */

import { useState, useRef } from 'react'
import { quickCommandLabelsLsKey } from '../../common/constants'
import { sortBy } from 'lodash-es'
import { Button, Input, Select, Space } from 'antd'
import * as ls from '../../common/safe-local-storage'
import CmdItem from './quick-command-item'
import {
  EditOutlined,
  CloseCircleOutlined,
  PushpinOutlined
} from '@ant-design/icons'
import classNames from 'classnames'
import onDropFunc from './on-drop'
import './qm.styl'

const e = window.translate
const addQuickCommands = 'addQuickCommands'
const { Option } = Select

export default function QuickCommandsFooterBox (props) {
  const [keyword, setKeyword] = useState('')
  const [labels, setLabels] = useState(ls.getItemJSON(quickCommandLabelsLsKey, []))
  const timer = useRef(null)

  function handleMouseLeave () {
    timer.current = setTimeout(() => {
      toggle(false)
    }, 500)
  }

  function handleMouseEnter () {
    clearTimeout(timer.current)
  }

  function toggle (openQuickCommandBar) {
    window.store.openQuickCommandBar = openQuickCommandBar
  }

  function handleTogglePinned () {
    window.store.pinnedQuickCommandBar = !window.store.pinnedQuickCommandBar
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
    window.store.pinnedQuickCommandBar = false
    window.store.openQuickCommandBar = false
  }

  function handleChange (e) {
    setKeyword(e.target.value)
  }

  function handleChangeLabels (v) {
    ls.setItemJSON(quickCommandLabelsLsKey, v)
    setLabels(v)
  }

  // function filterFunc (v, opt) {
  //   const c = opt.props.children.toLowerCase()
  //   const m = opt.props.cmd.toLowerCase()
  //   const vv = v.toLowerCase()
  //   return c.includes(vv) || m.includes(vv)
  // }

  function onDragOver (e) {
    e.preventDefault()
  }

  function onDragStart (e) {
    e.dataTransfer.setData('idDragged', e.target.getAttribute('data-id'))
  }

  function onDrop (e) {
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
    const {
      qmSortByFrequency
    } = props
    return (
      <CmdItem
        item={item}
        key={item.id}
        onSelect={handleSelect}
        draggable={!qmSortByFrequency}
        handleDragOver={onDragOver}
        handleDragStart={onDragStart}
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

  function sortArray (array, keyword, labels, qmSortByFrequency) {
    const sorters = [
      (obj) => !(keyword && obj.name.toLowerCase().includes(keyword)),
      (obj) => !labels.some((label) => (obj.labels || []).includes(label))
    ]
    if (qmSortByFrequency) {
      sorters.push((obj) => -(obj.clickCount || 0))
    }
    return sortBy(array, sorters)
  }

  const {
    openQuickCommandBar,
    pinnedQuickCommandBar,
    qmSortByFrequency,
    inActiveTerminal,
    leftSidebarWidth,
    openedSideBar
  } = props
  if ((!openQuickCommandBar && !pinnedQuickCommandBar) || !inActiveTerminal) {
    return null
  }
  const all = props.currentQuickCommands
  if (!all.length) {
    return renderNoCmd()
  }
  const keyword0 = keyword.toLowerCase()
  const filtered = sortArray(all, keyword0, labels, qmSortByFrequency)
    .map(d => {
      return {
        ...d,
        nameMatch: keyword && d.name.toLowerCase().includes(keyword),
        labelMatch: labels.some((label) => (d.labels || []).includes(label))
      }
    })
  const sprops = {
    value: labels,
    mode: 'multiple',
    onChange: handleChangeLabels,
    placeholder: e('labels'),
    className: 'iblock',
    style: {
      minWidth: '100px'
    }
  }
  const tp = pinnedQuickCommandBar
    ? 'primary'
    : 'ghost'
  const cls = classNames(
    'qm-list-wrap',
    { 'fil-label': !!labels.length },
    { 'fil-keyword': !!keyword }
  )
  const type = qmSortByFrequency ? 'primary' : 'default'
  const w = openedSideBar ? 43 + leftSidebarWidth : 43
  const qmProps = {
    className: 'qm-wrap-tooltip',
    style: {
      left: w
    },
    onMouseLeave: handleMouseLeave,
    onMouseEnter: handleMouseEnter
  }
  return (
    <div
      {...qmProps}
    >
      <div className='pd2'>
        <div className='pd2b fix'>
          <span className='fleft'>
            <Input.Search
              value={keyword}
              onChange={handleChange}
              placeholder=''
              className='iblock qm-search-input'
            />
          </span>
          <span className='fleft mg1l'>
            <Select
              {...sprops}
            >
              {props.quickCommandTags.map(
                renderTag
              )}
            </Select>
            <Button
              className='mg1l iblock'
              type={type}
              onClick={window.store.handleSortByFrequency}
            >
              {e('sortByFrequency')}
            </Button>
          </span>
          <span className='fright'>
            <Space.Compact>
              <Button
                onClick={handleTogglePinned}
                icon={<PushpinOutlined />}
                type={tp}
              />
              <Button
                onClick={window.store.handleOpenQuickCommandsSetting}
                icon={<EditOutlined />}
              />
              <Button
                onClick={handleClose}
                icon={<CloseCircleOutlined />}
              />
            </Space.Compact>
          </span>
        </div>
        <div className={cls}>
          {filtered.map(renderItem)}
        </div>
      </div>
    </div>
  )
}

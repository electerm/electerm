/**
 * quick commands footer selection wrap
 */

import { Component } from '../common/react-subx'
import { isWin, quickCommandLabelsLsKey } from '../../common/constants'
import { find, sortBy } from 'lodash-es'
import { Button, Input, Select, Space } from 'antd'
import * as ls from '../../common/safe-local-storage'
import generate from '../../common/uid'
import CmdItem from './quick-command-item'
import delay from '../../common/wait'
import {
  EditOutlined,
  CloseCircleOutlined,
  PushpinOutlined
} from '@ant-design/icons'
import classNames from 'classnames'
import './qm.styl'

const { prefix } = window
const e = prefix('quickCommands')
const addQuickCommands = 'addQuickCommands'
const { Option } = Select

export default class QuickCommandsFooterBox extends Component {
  state = {
    keyword: '',
    labels: ls.getItemJSON(quickCommandLabelsLsKey, [])
  }

  handleMouseLeave = () => {
    this.timer = setTimeout(() => {
      this.toggle(false)
    }, 500)
  }

  handleMouseEnter = () => {
    clearTimeout(this.timer)
  }

  toggle = (openQuickCommandBar) => {
    this.props.store.openQuickCommandBar = openQuickCommandBar
  }

  handleTogglePinned = () => {
    this.props.store.pinnedQuickCommandBar = !this.props.store.pinnedQuickCommandBar
  }

  handleSelect = async (id) => {
    const {
      store
    } = this.props
    if (id === addQuickCommands) {
      store.handleOpenQuickCommandsSetting()
    } else {
      const qm = find(
        this.props.store.currentQuickCommands,
        a => a.id === id
      )
      const { runQuickCommand } = this.props.store
      const qms = qm && qm.commands
        ? qm.commands
        : (qm && qm.command
            ? [
                {
                  command: qm.command,
                  id: generate(),
                  delay: 100
                }
              ]
            : []
          )
      for (const q of qms) {
        const realCmd = isWin
          ? q.command.replace(/\n/g, '\n\r')
          : q.command
        await delay(q.delay || 100)
        runQuickCommand(realCmd, qm.inputOnly)
        store.editQuickCommand(qm.id, {
          clickCount: ((qm.clickCount || 0) + 1)
        })
      }
    }
  }

  handleClose = () => {
    this.props.store.pinnedQuickCommandBar = false
    this.props.store.openQuickCommandBar = false
  }

  handleChange = e => {
    this.setState({
      keyword: e.target.value
    })
  }

  handleChangeLabels = (v) => {
    ls.setItemJSON(quickCommandLabelsLsKey, v)
    this.setState({
      labels: v
    })
  }

  filterFunc = (v, opt) => {
    const c = opt.props.children.toLowerCase()
    const m = opt.props.cmd.toLowerCase()
    const vv = v.toLowerCase()
    return c.includes(vv) || m.includes(vv)
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragStart = e => {
    e.dataTransfer.setData('idDragged', e.target.getAttribute('data-id'))
  }

  // sort quick commands array when drop, so that the dragged item will be placed at the right position, e.target.getAttribute('data-id') would target item id, e.dataTransfer.getData('idDragged') would target dragged item id, then set window.store.quickCommands use window.store.setItems
  onDrop = e => {
    e.preventDefault()
    const { store } = window
    const { quickCommands } = store
    const idDragged = e.dataTransfer.getData('idDragged')
    const idDrop = e.target.getAttribute('data-id')
    const idDraggedIndex = quickCommands.findIndex(
      ({ id }) => id === idDragged
    )
    const targetIndex = quickCommands.findIndex(
      ({ id }) => id === idDrop
    )
    if (idDraggedIndex < targetIndex) {
      quickCommands.splice(targetIndex, 0, quickCommands.splice(idDraggedIndex, 1)[0])
    } else {
      quickCommands.splice(targetIndex + 1, 0, quickCommands.splice(idDraggedIndex, 1)[0])
    }
    store.setItems('quickCommands', quickCommands)
  }

  renderNoCmd = () => {
    return (
      <div className='pd1'>
        <Button
          type='primary'
          onClick={this.props.store.handleOpenQuickCommandsSetting}
        >
          {e(addQuickCommands)}
        </Button>
      </div>
    )
  }

  renderItem = (item) => {
    const {
      qmSortByFrequency
    } = this.props.store
    return (
      <CmdItem
        item={item}
        key={item.id}
        onSelect={this.handleSelect}
        draggable={!qmSortByFrequency}
        handleDragOver={this.onDragOver}
        handleDragStart={this.onDragStart}
        handleDrop={this.onDrop}
      />
    )
  }

  renderTag = tag => {
    return (
      <Option
        value={tag}
        key={'tag-' + tag}
      >
        {tag}
      </Option>
    )
  }

  sortArray (array, keyword, labels, qmSortByFrequency) {
    const sorters = [
      (obj) => !(keyword && obj.name.toLowerCase().includes(keyword)),
      (obj) => !labels.some((label) => obj.labels.includes(label))
    ]
    if (qmSortByFrequency) {
      sorters.push((obj) => -(obj.clickCount || 0))
    }
    return sortBy(array, sorters)
  }

  render () {
    const {
      openQuickCommandBar,
      pinnedQuickCommandBar,
      qmSortByFrequency
    } = this.props.store
    if (!openQuickCommandBar && !pinnedQuickCommandBar) {
      return null
    }
    const all = this.props.store.currentQuickCommands
    if (!all.length) {
      return this.renderNoCmd()
    }
    const keyword = this.state.keyword.toLowerCase()
    const { labels } = this.state
    const filtered = this.sortArray(all, keyword, labels, qmSortByFrequency)
      .map(d => {
        return {
          ...d,
          nameMatch: keyword && d.name.toLowerCase().includes(keyword),
          labelMatch: labels.some((label) => d.labels.includes(label))
        }
      })
    const sprops = {
      value: labels,
      mode: 'multiple',
      onChange: this.handleChangeLabels,
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
      { 'fil-label': !!this.state.labels.length },
      { 'fil-keyword': !!keyword }
    )
    const type = qmSortByFrequency ? 'primary' : 'default'
    return (
      <div
        className='qm-wrap-tooltip'
        onMouseLeave={this.handleMouseLeave}
        onMouseEnter={this.handleMouseEnter}
      >
        <div className='pd2'>
          <div className='pd2b fix'>
            <span className='fleft'>
              <Input.Search
                value={this.state.keyword}
                onChange={this.handleChange}
                placeholder=''
                className='iblock qm-search-input'
              />
            </span>
            <span className='fleft mg1l'>
              <Select
                {...sprops}
              >
                {this.props.store.quickCommandTags.map(
                  this.renderTag
                )}
              </Select>
              <Button
                className='mg1l iblock'
                type={type}
                onClick={this.props.store.handleSortByFrequency}
              >
                {e('sortByFrequency')}
              </Button>
            </span>
            <span className='fright'>
              <Space.Compact>
                <Button
                  onClick={this.handleTogglePinned}
                  icon={<PushpinOutlined />}
                  type={tp}
                />
                <Button
                  onClick={this.props.store.handleOpenQuickCommandsSetting}
                  icon={<EditOutlined />}
                />
                <Button
                  onClick={this.handleClose}
                  icon={<CloseCircleOutlined />}
                />
              </Space.Compact>
            </span>
          </div>
          <div className={cls}>
            {filtered.map(this.renderItem)}
          </div>
        </div>
      </div>
    )
  }
}

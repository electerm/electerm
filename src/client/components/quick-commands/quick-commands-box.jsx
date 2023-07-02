/**
 * quick commands footer selection wrap
 */

import { Component } from '../common/react-subx'
import { isWin } from '../../common/constants'
import _ from 'lodash'
import { Button, Input, Select } from 'antd'
import copy from 'json-deep-copy'
import CmdItem from './quick-command-item'
import {
  EditOutlined,
  CloseCircleOutlined,
  PushpinOutlined
} from '@ant-design/icons'
import './qm.styl'

const { prefix } = window
const e = prefix('quickCommands')
const addQuickCommands = 'addQuickCommands'
const { Option } = Select

export default class QuickCommandsFooterBox extends Component {
  state = {
    keyword: '',
    labels: []
  }

  onMouseLeave = () => {
    this.timer = setTimeout(() => {
      this.toggle(false)
    }, 500)
  }

  onMouseEnter = () => {
    clearTimeout(this.timer)
  }

  toggle = (openQuickCommandBar) => {
    this.props.store.openQuickCommandBar = openQuickCommandBar
  }

  togglePinned = () => {
    this.props.store.pinnedQuickCommandBar = !this.props.store.pinnedQuickCommandBar
  }

  onSelect = (id) => {
    if (id === addQuickCommands) {
      this.props.store.openQuickCommandsSetting()
    } else {
      const qm = _.find(
        this.props.store.currentQuickCommands,
        a => a.id === id
      )
      if (qm && qm.command) {
        const { runQuickCommand } = this.props.store
        const realCmd = isWin
          ? qm.command.replace(/\n/g, '\n\r')
          : qm.command
        runQuickCommand(realCmd, qm.inputOnly)
      }
    }
  }

  close = () => {
    this.props.store.pinnedQuickCommandBar = false
    this.props.store.openQuickCommandBar = false
  }

  handleChange = e => {
    this.setState({
      keyword: e.target.value
    })
  }

  handleChangeLabels = (v) => {
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

  renderNoCmd = () => {
    return (
      <div className='pd1'>
        <Button
          type='primary'
          onClick={this.props.store.openQuickCommandsSetting}
        >
          {e(addQuickCommands)}
        </Button>
      </div>
    )
  }

  renderItem = (item) => {
    return (
      <CmdItem
        item={item}
        key={item.id}
        onSelect={this.onSelect}
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

  render () {
    const {
      openQuickCommandBar,
      pinnedQuickCommandBar
    } = this.props.store
    if (!openQuickCommandBar && !pinnedQuickCommandBar) {
      return null
    }
    const all = copy(this.props.store.currentQuickCommands)
    if (!all.length) {
      return this.renderNoCmd()
    }
    const keyword = this.state.keyword.toLowerCase()
    let filtered = keyword
      ? all.filter(d => {
        return d.name.toLowerCase().includes(keyword) || d.command.toLowerCase().includes(keyword)
      })
      : all
    const { labels } = this.state
    if (labels.length) {
      filtered = filtered.filter(d => {
        return labels.some(label => {
          return (d.labels || []).includes(label)
        })
      })
    }
    const sprops = {
      value: this.state.labels,
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
    return (
      <div
        className='qm-wrap-tooltip'
        onMouseLeave={this.onMouseLeave}
        onMouseEnter={this.onMouseEnter}
      >
        <div className='pd2'>
          <div className='pd2b fix'>
            <span className='fleft'>
              <Input.Search
                value={this.state.keyword}
                onChange={this.handleChange}
                placeholder=''
                className='iblock'
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
            </span>
            <span className='fright'>
              <Button
                onClick={this.togglePinned}
                icon={<PushpinOutlined />}
                type={tp}
              />
              <Button
                onClick={this.props.store.openQuickCommandsSetting}
                icon={<EditOutlined />}
              />
              <Button
                onClick={this.close}
                icon={<CloseCircleOutlined />}
              />
            </span>
          </div>
          <div className='qm-list-wrap'>
            {filtered.map(this.renderItem)}
          </div>
        </div>
      </div>
    )
  }
}

/**
 * quick commands footer selection
 */

import { Component } from '../common/react-subx'
import { isWin } from '../../common/constants'
import _ from 'lodash'
import { Popover, Button, Input } from 'antd'
import copy from 'json-deep-copy'
import CmdItem from './quick-command-item'
import {
  EditOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import './qm.styl'

const { prefix } = window
const e = prefix('quickCommands')
const addQuickCommands = 'addQuickCommands'

export default class QuickCommandsFooter extends Component {
  state = {
    visible: false,
    keyword: ''
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
        const realCmd = isWin
          ? qm.command.replace(/\n/g, '\n\r')
          : qm.command
        window.postMessage({
          action: 'quick-command',
          command: realCmd,
          inputOnly: qm.inputOnly
        }, '*')
      }
    }
  }

  handleHoverChange = (v) => {
    this.setState({
      visible: v
    })
  }

  close = () => {
    this.setState({
      visible: false
    })
  }

  handleChange = e => {
    this.setState({
      keyword: e.target.value,
      visible: true
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

  content = () => {
    const all = copy(this.props.store.currentQuickCommands)
    if (!all.length) {
      return this.renderNoCmd()
    }
    const keyword = this.state.keyword.toLowerCase()
    const filtered = keyword
      ? all.filter(d => {
        return d.name.toLowerCase().includes(keyword) || d.command.toLowerCase().includes(keyword)
      })
      : all
    return (
      <div>
        <div className='pd2b fix'>
          <span className='fleft'>
            <Input.Search
              value={this.state.keyword}
              onChange={this.handleChange}
              placeholder=''
              className='iblock'
            />
          </span>
          <span className='fright'>
            <Button
              className='mg1x iblock'
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
    )
  }

  render () {
    const all = copy(this.props.store.currentQuickCommands)
    if (!all.length) {
      all.push({
        id: addQuickCommands,
        name: e(addQuickCommands)
      })
    }
    const rProps = {
      trigger: 'hover',
      visible: this.state.visible,
      content: this.content(),
      onVisibleChange: this.handleHoverChange
    }
    return (
      <div className='fleft relative'>
        <Popover
          {...rProps}
        >
          <Button
            size='small'
            type='ghost'
            className='qm-trigger'
          >{e('quickCommands')}</Button>
        </Popover>
      </div>
    )
  }
}

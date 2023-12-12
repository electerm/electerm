/**
 * info content module
 */

import { PureComponent } from 'react'
import TerminalInfoBase from './base'
import TerminalInfoUp from './up'
import TerminalInfoNetwork from './network'
import TerminalInfoResource from './resource'
import TerminalInfoActivities from './activity'
import TerminalInfoDisk from './disk'
import RunCmd from './run-cmd'
import {
  termControlHeight
} from '../../common/constants'
import { runCmd } from '../terminal/terminal-apis'
import {
  CloseCircleOutlined,
  PushpinOutlined
} from '@ant-design/icons'
import classNames from 'classnames'

export default class TerminalInfoContent extends PureComponent {
  state = {
    uptime: '',
    cpu: '',
    mem: {},
    swap: {},
    activities: [],
    disks: [],
    network: {}
  }

  setStateRef = (...args) => {
    this.setState(...args)
  }

  togglePin = () => {
    this.props.toggleInfoPinned()
  }

  handleMousedown = (e) => {
    this.dragStart = true
    this.clientX = e.clientX
    document.body.addEventListener('mouseup', this.handleMouseup)
    document.body.addEventListener('mousemove', this.handleMousemove)
  }

  handleMouseup = (e) => {
    this.dragStart = false
    const {
      clientX
    } = e
    let nw = this.clientX - clientX + this.props.rightSidebarWidth
    if (nw < 400) {
      nw = 400
    } else if (nw > 1000) {
      nw = 1000
    }
    window.store.setRightSidePanelWidth(nw)
    document.body.removeEventListener('mouseup', this.handleMouseup)
    document.body.removeEventListener('mousemove', this.handleMousemove)
  }

  handleMousemove = (e) => {
    const {
      clientX
    } = e
    const el = document.getElementById('info-panel-wrap')
    let nw = this.clientX - clientX + this.props.rightSidebarWidth
    if (nw < 400) {
      nw = 400
    } else if (nw > 1000) {
      nw = 1000
    }
    el.style.width = nw + 'px'
  }

  killProcess = async (id) => {
    const {
      pid,
      sessionId
    } = this.props
    const cmd = `kill ${id}`
    runCmd(pid, sessionId, cmd)
  }

  render () {
    const { props, state } = this
    if (!props.showInfo) {
      return null
    }

    const pops = {
      onClick: props.hideInfoPanel,
      className: 'pointer font20 hide-info-panel-wrap'
    }
    const pops2 = {
      onClick: this.togglePin,
      className: 'pointer font20 toggle-info-panel-wrap mg1l'
    }
    const pops1 = {
      className: classNames(
        'info-panel-wrap',
        {
          'info-panel-wrap-pin': props.infoPanelPinned
        }
      ),
      id: 'info-panel-wrap',
      draggable: false,
      style: {
        width: props.rightSidebarWidth,
        top: props.topMenuHeight + props.tabsHeight + termControlHeight - 4
      }
    }
    return (
      <div
        {...pops1}
      >
        <div
          className='drag-handle'
          onMouseDown={this.handleMousedown}
          draggable={false}
        />
        <div className='pd2t pd2x'>
          <CloseCircleOutlined
            {...pops}
          />
          <PushpinOutlined
            {...pops2}
          />
        </div>
        <div className='pd2'>
          <TerminalInfoBase {...props} {...state} />
          <TerminalInfoUp {...props} {...state} />
          <TerminalInfoResource
            {...props} {...state}
          />
          <TerminalInfoActivities
            {...props}
            {...state}
            killProcess={this.killProcess}
          />
          <TerminalInfoNetwork {...props} {...state} />
          <TerminalInfoDisk {...props} {...state} />
          <RunCmd {...props} setState={this.setStateRef} />
        </div>
      </div>
    )
  }
}

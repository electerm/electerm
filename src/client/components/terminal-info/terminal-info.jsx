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
import { runCmd } from '../terminal/terminal-apis'
import './terminal-info.styl'

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
    if (props.rightPanelTab === 'ai') {
      return null
    }
    return (
      <div>
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
    )
  }
}

/**
 * info content module
 */

import TerminalInfoBase from './base'
import TerminalInfoUp from './up'
import TerminalInfoNetwork from './network'
import TerminalInfoResource from './resource'
import TerminalInfoActivities from './activity'
import TerminalInfoDisk from './disk'
import { useState } from 'react'
import RunCmd from './run-cmd'
import {
  sidebarWidth,
  termControlHeight
} from '../../common/constants'
import { runCmd } from '../terminal/terminal-apis'
import { CloseCircleOutlined, LeftCircleOutlined, RightCircleOutlined } from '@ant-design/icons'

export default function TerminalInfoContent (props) {
  if (!props.showInfo) {
    return null
  }
  const [state, setter] = useState({
    expand: false,
    uptime: '',
    cpu: '',
    mem: {},
    swap: {},
    activities: [],
    disks: [],
    network: {}
  })
  function setState (ext) {
    setter(s => {
      return Object.assign({}, s, ext)
    })
  }
  async function killProcess (id) {
    const {
      pid,
      sessionId
    } = props
    const cmd = `kill ${id}`
    runCmd(pid, sessionId, cmd)
  }
  const pops = {
    onClick: props.hideInfoPanel,
    className: 'pointer font20 hide-info-panel-wrap'
  }
  return (
    <div
      className='info-panel-wrap'
      style={{
        width: state.expand ? `calc(100% - ${sidebarWidth}px)` : '50%',
        top: props.topMenuHeight + props.tabsHeight + termControlHeight - 4
      }}
    >
      <div className='pd2t pd2x'>
        <CloseCircleOutlined
          {...pops}
        />
        {
          state.expand
            ? (
              <RightCircleOutlined
                onClick={() => setState({
                  expand: false
                })}
                className='pointer font20 mg1l'
              />
              )
            : (
              <LeftCircleOutlined
                onClick={() => setState({
                  expand: true
                })}
                className='pointer font20 mg1l'
              />
              )
        }

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
          killProcess={killProcess}
        />
        <TerminalInfoNetwork {...props} {...state} />
        <TerminalInfoDisk {...props} {...state} />
        <RunCmd {...props} setState={setState} />
      </div>
    </div>
  )
}

/**
 * show base terminal info, id sessionID
 */
import { Component } from 'react'
import { osResolve } from '../../common/resolve'
import {
  commonActions
} from '../../common/constants'
import {
  Switch
} from 'antd'
import ShowItem from '../common/show-item'
import postMsg from '../../common/post-msg'
import { toggleTerminalLog } from '../terminal/terminal-apis'

const { prefix } = window
const st = prefix('setting')

export default class TerminalInfoBase extends Component {
  state = {
    saveTerminalLogToFile: false
  }

  componentDidMount () {
    this.getState()
    window.addEventListener('message', this.onEvent)
  }

  componentWillUnmount () {
    this.exit()
  }

  handleToggle = () => {
    const { saveTerminalLogToFile } = this.state
    const {
      pid,
      sessionId
    } = this.props
    toggleTerminalLog(
      pid,
      sessionId
    )
    const nv = !saveTerminalLogToFile
    this.setState({
      saveTerminalLogToFile: nv
    })
    postMsg({
      action: commonActions.setTermLogState,
      pid,
      saveTerminalLogToFile: nv,
      sessionId
    })
  }

  onEvent = (e) => {
    const {
      action,
      state,
      pid: ppid
    } = e.data || {}
    if (
      action === commonActions.returnTermLogState &&
      this.props.pid === ppid
    ) {
      this.setState({
        saveTerminalLogToFile: state
      })
      window.removeEventListener('message', this.onEvent)
    }
  }

  getState = () => {
    const {
      pid,
      sessionId
    } = this.props
    postMsg({
      action: commonActions.getTermLogState,
      pid,
      sessionId
    })
  }

  exit = () => {
    window.removeEventListener('message', this.onEvent)
  }

  render () {
    const {
      id,
      logName,
      appPath
    } = this.props
    const { saveTerminalLogToFile } = this.state
    const base = appPath
      ? osResolve(appPath, 'electerm', 'session_logs')
      : window.et.sessionLogPath
    const path = osResolve(base, logName + '.log')
    const name = st('saveTerminalLogToFile')
    const to = saveTerminalLogToFile
      ? <ShowItem disabled={!saveTerminalLogToFile} to={path}>{path}</ShowItem>
      : path
    return (
      <div className='terminal-info-section terminal-info-base'>
        <div className='fix'>
          <span className='fleft'><b>ID:</b> {id}</span>
          <span className='fright'>
            <Switch
              checkedChildren={name}
              unCheckedChildren={name}
              checked={saveTerminalLogToFile}
              onChange={this.handleToggle}
            />
          </span>
        </div>
        <p><b>log:</b> {to}</p>
      </div>
    )
  }
}

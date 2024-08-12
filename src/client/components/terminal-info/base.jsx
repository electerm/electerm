/**
 * show base terminal info, id sessionID
 */
import { Component } from 'react'
import { osResolve } from '../../common/resolve'
import {
  commonActions
} from '../../common/constants'
import {
  Switch,
  Space,
  Button
} from 'antd'
import ShowItem from '../common/show-item'
import defaults from '../../common/default-setting'
import postMsg from '../../common/post-msg'
import { toggleTerminalLog, toggleTerminalLogTimestamp } from '../terminal/terminal-apis'
import { ClockCircleOutlined, BorderlessTableOutlined, DatabaseOutlined, BarsOutlined, ApiOutlined, PartitionOutlined } from '@ant-design/icons'

const e = window.translate

const mapper = {
  uptime: <ClockCircleOutlined />,
  cpu: <BorderlessTableOutlined />,
  mem: <DatabaseOutlined />,
  activities: <BarsOutlined />,
  network: <ApiOutlined />,
  disks: <PartitionOutlined />
}

export default class TerminalInfoBase extends Component {
  state = {
    saveTerminalLogToFile: false,
    addTimeStampToTermLog: false
  }

  componentDidMount () {
    this.getState()
    window.addEventListener('message', this.onEvent)
  }

  componentWillUnmount () {
    this.exit()
  }

  handleToggleTimestamp = () => {
    const { saveTerminalLogToFile, addTimeStampToTermLog } = this.state
    const {
      pid,
      sessionId
    } = this.props
    toggleTerminalLogTimestamp(
      pid,
      sessionId
    )
    const nv = !addTimeStampToTermLog
    this.setState({
      addTimeStampToTermLog: nv
    })
    postMsg({
      action: commonActions.setTermLogState,
      pid,
      addTimeStampToTermLog: nv,
      saveTerminalLogToFile,
      sessionId
    })
  }

  toggleTerminalLogInfo = (h) => {
    const { terminalInfos } = this.props
    const nv = terminalInfos.includes(h)
      ? terminalInfos.filter(f => f !== h)
      : [...terminalInfos, h]
    window.store.setConfig({
      terminalInfos: nv
    })
  }

  handleToggle = () => {
    const { saveTerminalLogToFile, addTimeStampToTermLog } = this.state
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
      addTimeStampToTermLog,
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
      this.setState(state)
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

  renderTimestamp () {
    const { saveTerminalLogToFile, addTimeStampToTermLog } = this.state
    if (!saveTerminalLogToFile) {
      return null
    }
    const name = e('addTimeStampToTermLog')
    return (
      <Switch
        checkedChildren={name}
        unCheckedChildren={name}
        checked={addTimeStampToTermLog}
        onChange={this.handleToggleTimestamp}
        className='mg1b'
      />
    )
  }

  renderInfoSelection () {
    const {
      terminalInfos
    } = this.props
    return (
      <Space.Compact block>
        {
          defaults.terminalInfos.map(f => {
            const type = terminalInfos.includes(f) ? 'primary' : 'default'
            return (
              <Button
                key={f + 'term-info-sel'}
                type={type}
                size='small'
                onClick={() => this.toggleTerminalLogInfo(f)}
                className='cap'
                icon={mapper[f]}
              >
                {f}
              </Button>
            )
          })
        }
      </Space.Compact>
    )
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
    const name = e('saveTerminalLogToFile')
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
              className='mg1r mg1b'
            />
            {
              this.renderTimestamp()
            }
          </span>
        </div>
        <div className='pd2y'>
          {
            this.renderInfoSelection()
          }
        </div>
        <p><b>log:</b> {to}</p>
      </div>
    )
  }
}

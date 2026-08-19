/**
 * show base terminal info, id sessionID
 */
import { Component } from 'react'
import {
  Button,
  Dropdown
} from 'antd'
import SwitchLabel from '../common/switch'
import defaults from '../../common/default-setting'
import { toggleTerminalLog, toggleTerminalLogTimestamp } from '../terminal/terminal-apis'
import {
  ClockCircleOutlined,
  BorderlessTableOutlined,
  DatabaseOutlined,
  BarsOutlined,
  ApiOutlined,
  PartitionOutlined,
  FilterOutlined,
  CheckOutlined
} from '@ant-design/icons'
import { refs } from '../common/ref'
import ShowItem from '../common/show-item'
import { osResolve } from '../../common/resolve'
import createDefaultLogPath from '../../common/default-log-path'

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
    addTimeStampToTermLog: false,
    logPath: '',
    logFileName: ''
  }

  componentDidMount () {
    const { pid } = this.props
    refs.add('term-info-' + pid, this)
    this.getState()
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
    const { pid } = this.props
    refs.remove('term-info-' + pid)
  }

  handleToggleTimestamp = () => {
    const { saveTerminalLogToFile, addTimeStampToTermLog } = this.state
    const {
      pid
    } = this.props
    toggleTerminalLogTimestamp(
      pid
    )
    const nv = !addTimeStampToTermLog
    this.setState({
      addTimeStampToTermLog: nv
    })
    refs.get('term-' + pid)?.setState({
      addTimeStampToTermLog: nv,
      saveTerminalLogToFile
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
      pid
    } = this.props
    toggleTerminalLog(
      pid
    )
    const nv = !saveTerminalLogToFile
    this.setState({
      saveTerminalLogToFile: nv
    })
    refs.get('term-' + pid)?.setState({
      saveTerminalLogToFile: nv,
      addTimeStampToTermLog
    })
  }

  getState = () => {
    const {
      pid
    } = this.props
    const term = refs.get('term-' + pid)
    if (term) {
      this.setState({
        saveTerminalLogToFile: term.state.saveTerminalLogToFile,
        addTimeStampToTermLog: term.state.addTimeStampToTermLog,
        logPath: term.state.logPath,
        logFileName: term.state.logFileName || ''
      })
    } else {
      this.timer = setTimeout(this.getState, 100)
    }
  }

  renderTimestamp () {
    const { saveTerminalLogToFile, addTimeStampToTermLog } = this.state
    if (!saveTerminalLogToFile) {
      return null
    }
    const name = e('addTimeStampToTermLog')
    return (
      <SwitchLabel
        label={name}
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
    const items = defaults.terminalInfos.map(f => {
      const checked = terminalInfos.includes(f)
      return {
        key: f,
        label: (
          <span
            className='term-info-filter-label'
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ width: '14px' }}>{checked ? <CheckOutlined /> : null}</span>
            {mapper[f]} {f}
          </span>
        ),
        onClick: () => this.toggleTerminalLogInfo(f)
      }
    })
    return (
      <Dropdown
        menu={{ items }}
        trigger={['click']}
        placement='bottomRight'
      >
        <Button
          size='small'
          icon={<FilterOutlined />}
        >
          {e('filter')}({terminalInfos.length}/{defaults.terminalInfos.length})
        </Button>
      </Dropdown>
    )
  }

  render () {
    const {
      id,
      logName
    } = this.props
    const { saveTerminalLogToFile, logPath, logFileName } = this.state
    const name = e('saveTerminalLogToFile')
    const base = logPath || createDefaultLogPath()
    const fileName = logFileName || (logName + '.log')
    const fullPath = osResolve(base, fileName)
    return (
      <div className='terminal-info-section terminal-info-base'>
        <div className='pd1b'>
          <b>ID:</b> {id}
        </div>
        <div className='pd1b'>
          <SwitchLabel
            label={name}
            checked={saveTerminalLogToFile}
            onChange={this.handleToggle}
            className='mg1r mg1b'
          />
          {
            this.renderTimestamp()
          }
        </div>
        {
          saveTerminalLogToFile
            ? (
              <div className='pd1b font-xs color-grey'>
                {e('terminalLogPath')}: {fullPath} <ShowItem to={fullPath} />
              </div>
              )
            : null
        }
        <div className='pd2y'>
          {
            this.renderInfoSelection()
          }
        </div>

      </div>
    )
  }
}

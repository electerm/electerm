/**
 * show base terminal info, id sessionID
 */
import { Component } from 'react'
import ItemFilter from '../common/item-filter'
import SwitchLabel from '../common/switch'
import { INFO_PANEL_ITEM_IDS } from '../remote-monitor/monitor-model'
import { setWatcherEnabled } from '../remote-monitor/watcher-toggle'
import { watcherLabels } from '../../common/custom-watcher'
import { toggleTerminalLog, toggleTerminalLogTimestamp } from '../terminal/terminal-apis'
import { refs } from '../common/ref'
import ShowItem from '../common/show-item'
import { osResolve } from '../../common/resolve'
import createDefaultLogPath from '../../common/default-log-path'

const e = window.translate

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

  handleToggleInfo = (id) => {
    // a watcher is not part of the panel's global item list: it belongs to the
    // bookmark, and switching it off stops it polling as well
    if (this.isWatcher(id)) {
      setWatcherEnabled(this.props.tab, id)
      return
    }
    const selected = new Set(this.props.terminalInfos || [])
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      selected.add(id)
    }
    window.store.setTerminalInfos(INFO_PANEL_ITEM_IDS.filter(x => selected.has(x)))
  }

  isWatcher (id) {
    const watchers = this.props.watchers || []
    return watchers.some(watcher => watcher.id === id)
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

  renderInfoFilter () {
    const watchers = this.props.watchers || []
    // built-in sections come from the global config, watchers from the bookmark:
    // one checklist, two stores, both toggled here
    const selected = [
      ...(this.props.terminalInfos || []),
      ...watchers.filter(watcher => watcher.enabled).map(watcher => watcher.id)
    ]
    return (
      <ItemFilter
        ids={[...INFO_PANEL_ITEM_IDS, ...watchers.map(watcher => watcher.id)]}
        labels={watcherLabels(watchers)}
        onToggle={this.handleToggleInfo}
        selected={selected}
      />
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
        <div className='terminal-info-filter-wrap'>
          {
            this.renderInfoFilter()
          }
        </div>

      </div>
    )
  }
}

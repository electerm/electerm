import { Component } from '../common/react-subx'
import { createTerm } from './terminal-apis'
import getProxy from '../../common/get-proxy'
import deepCopy from 'json-deep-copy'
import clone from '../../common/to-simple-obj'
import { handleErr } from '../../common/fetch'
import {
  statusMap
} from '../../common/constants'

export default class RdpSession extends Component {
  componentDidMount () {
    const {
      tab
    } = this.props
    tab.url && window.openLink(tab.url)
  }

  runInitScript = () => {

  }

  remoteInit = async (term = this.term) => {
    this.setState({
      loading: true
    })
    const { config } = this.props
    const {
      host,
      port,
      tokenElecterm,
      server = ''
    } = config
    const { sessionId, terminalIndex, id } = this.props
    const tab = deepCopy(this.props.tab || {})
    const {
      type,
      term: terminalType
    } = tab
    const opts = clone({
      term: terminalType || config.terminalType,
      sessionId,
      tabId: id,
      srcTabId: tab.id,
      terminalIndex,
      termType: type,
      readyTimeout: config.sshReadyTimeout,
      proxy: getProxy(tab, config)
    })
    delete opts.terminals
    let pid = await createTerm(opts)
      .catch(err => {
        const text = err.message
        handleErr({ message: text })
      })
    pid = pid || ''
    this.setState({
      loading: false
    })
    if (!pid) {
      this.setStatus(statusMap.error)
      return
    }
    this.setStatus(statusMap.success)
    this.props.setSessionState({
      pid
    })
    this.pid = pid
    this.setState({
      pid
    })
    const hs = server
      ? server.replace(/https?:\/\//, '')
      : `${host}:${port}`
    const pre = server.startsWith('https') ? 'wss' : 'ws'
    const wsUrl = `${pre}://${hs}/terminals/${pid}?sessionId=${sessionId}&token=${tokenElecterm}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    this.socket = socket
    this.term = term
    socket.onopen = () => {
      this.runInitScript()
    }
  }

  render () {
    return (
      <div className='rdp-session-wrap'>
        <canvas />
      </div>
    )
  }
}

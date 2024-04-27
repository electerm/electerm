import { Component } from '../common/react-subx'
import { createTerm } from './terminal-apis'
import deepCopy from 'json-deep-copy'
import clone from '../../common/to-simple-obj'
import { handleErr } from '../../common/fetch'
import {
  statusMap
} from '../../common/constants'
import {
  notification,
  Spin,
  Button
} from 'antd'
import {
  ReloadOutlined
} from '@ant-design/icons'

const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')

export default class RdpSession extends Component {
  state = {
    loading: false
  }

  componentDidMount () {
    const {
      tab
    } = this.props
    tab.url && window.openLink(tab.url)
  }

  componentWillUnmount () {
    this.socket && this.socket.close()
    delete this.socket
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
    const { sessionId, id } = this.props
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
      termType: type
    })
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
    const wsUrl = `${pre}://${hs}/rdp/${pid}?sessionId=${sessionId}&token=${tokenElecterm}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    this.socket = socket
    socket.onopen = () => {
      this.runInitScript()
    }
    socket.onmessage = this.onData
  }

  onData = async (msg) => {
    const data = JSON.parse(msg.toString())
    if (data.action === 'session-rdp-connected') {
      return this.setState({
        loading: false
      })
    }
    if (data.bitmap) {
      const canvas = document.getElementById('canvas-1')
      const ctx = canvas.getContext('2d')
      const img = window.createImageBitmap(data.bitmap)
      ctx.drawImage(img, 0, 0)
    }
  }

  onerrorSocket = err => {
    this.setStatus(statusMap.error)
    log.error('socket error', err)
  }

  oncloseSocket = () => {
    if (this.onClose || !this.props.tab.enableSsh) {
      return
    }
    this.setStatus(
      statusMap.error
    )
    if (!this.isActiveTerminal() || !window.focused) {
      return false
    }
    if (this.userTypeExit) {
      return this.props.delSplit(this.state.id)
    }
    const key = `open${Date.now()}`
    function closeMsg () {
      notification.destroy(key)
    }
    this.socketCloseWarning = notification.warning({
      key,
      message: e('socketCloseTip'),
      duration: 30,
      description: (
        <div className='pd2y'>
          <Button
            className='mg1r'
            type='primary'
            onClick={() => {
              closeMsg()
              this.props.delSplit(this.state.id)
            }}
          >
            {m('close')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              closeMsg()
              this.props.reloadTab(
                this.props.tab
              )
            }}
          >
            {m('reload')}
          </Button>
        </div>
      )
    })
  }

  render () {
    return (
      <div className='rdp-session-wrap'>
        <canvas />
      </div>
    )
  }
}

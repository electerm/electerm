import { PureComponent, createRef } from 'react'
import { createTerm } from '../terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import clone from '../../common/to-simple-obj'
import { handleErr } from '../../common/fetch'
import {
  statusMap
} from '../../common/constants'
import {
  Spin
} from 'antd'
import {
  ReloadOutlined
} from '@ant-design/icons'
import RemoteFloatControl from '../common/remote-float-control'

async function loadSpiceModule () {
  if (window.spiceHtml5) return
  console.debug('[SPICE-CLIENT] Loading SPICE HTML5 module...')
  const mod = await import('@spice-project/spice-html5')
  window.spiceHtml5 = {
    SpiceMainConn: mod.SpiceMainConn,
    SpiceConn: mod.SpiceConn
  }
  console.debug('[SPICE-CLIENT] SPICE HTML5 module loaded')
}

export default class SpiceSession extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      loading: false,
      connected: false
    }
    this.spiceConn = null
  }

  domRef = createRef()

  componentDidMount () {
    this.remoteInit()
  }

  componentWillUnmount () {
    this.cleanup()
  }

  cleanup = () => {
    console.debug('[SPICE-CLIENT] cleanup() called')
    if (this.spiceConn) {
      try {
        this.spiceConn.stop()
        console.debug('[SPICE-CLIENT] spiceConn.stop() called')
      } catch (e) {
        console.debug('[SPICE-CLIENT] spiceConn.stop() error:', e)
      }
      this.spiceConn = null
    }
  }

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
  }

  buildWsUrl = (port, type = 'spice', extra = '') => {
    const { host, tokenElecterm } = this.props.config
    const { id } = this.props.tab
    if (window.et.buildWsUrl) {
      return window.et.buildWsUrl(
        host,
        port,
        tokenElecterm,
        id,
        type,
        extra
      )
    }
    return `ws://${host}:${port}/${type}/${id}?token=${tokenElecterm}${extra}`
  }

  calcCanvasSize = () => {
    const { width, height } = this.props
    return {
      width: width - 10,
      height: height - 80
    }
  }

  getControlProps = (options = {}) => {
    const {
      fixedPosition = true,
      showExitFullscreen = true,
      className = ''
    } = options

    return {
      isFullScreen: this.props.fullscreen,
      onSendCtrlAltDel: this.handleSendCtrlAltDel,
      screens: [],
      currentScreen: null,
      onSelectScreen: () => {},
      fixedPosition,
      showExitFullscreen,
      className
    }
  }

  renderControl = () => {
    const contrlProps = this.getControlProps({
      fixedPosition: false,
      showExitFullscreen: false,
      className: 'mg1l'
    })
    return (
      <div className='pd1 fix session-v-info'>
        <div className='fleft'>
          <ReloadOutlined
            onClick={this.handleReInit}
            className='mg2r mg1l pointer'
          />
          {this.renderInfo()}
        </div>
        <div className='fright'>
          {this.props.fullscreenIcon()}
          <RemoteFloatControl {...contrlProps} />
        </div>
      </div>
    )
  }

  remoteInit = async () => {
    this.setState({
      loading: true
    })
    const { config } = this.props
    const { id } = this.props
    const tab = window.store.applyProfile(deepCopy(this.props.tab || {}))
    const {
      type,
      term: terminalType,
      password
    } = tab
    const opts = clone({
      term: terminalType || config.terminalType,
      tabId: id,
      uid: tab.id,
      srcTabId: tab.id,
      termType: type,
      ...tab
    })

    console.debug('[SPICE-CLIENT] Creating SPICE session term, host=', tab.host, 'port=', tab.port)
    const r = await createTerm(opts)
      .catch(err => {
        const text = err.message
        handleErr({ message: text })
      })
    if (!r) {
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
      console.error('[SPICE-CLIENT] createTerm failed')
      return
    }

    const { pid, port } = r
    this.pid = pid
    console.debug('[SPICE-CLIENT] Term created, pid=', pid, 'port=', port)

    try {
      await loadSpiceModule()
    } catch (e) {
      console.error('[SPICE-CLIENT] Failed to load SPICE module:', e)
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
      return
    }

    this.setStatus(statusMap.success)

    const { width, height } = this.calcCanvasSize()
    const wsUrl = this.buildWsUrl(port, 'spice', `&width=${width}&height=${height}`)

    try {
      const container = this.domRef.current
      if (!container) {
        console.error('[SPICE-CLIENT] Container ref not available')
        this.setState({ loading: false })
        return
      }

      console.debug('[SPICE-CLIENT] Connecting to SPICE server:', wsUrl)

      const SpiceMainConn = window.spiceHtml5.SpiceMainConn
      const spiceOpts = {
        uri: wsUrl,
        password: password || '',
        onsuccess: () => {
          console.debug('[SPICE-CLIENT] Connected successfully')
          this.setState({
            loading: false,
            connected: true
          })
          this.setStatus(statusMap.success)
        },
        onerror: (e) => {
          console.error('[SPICE-CLIENT] Connection error:', e)
          this.setState({ loading: false })
          this.setStatus(statusMap.error)
        },
        onagent: (agent) => {
          console.debug('[SPICE-CLIENT] Agent connected')
        }
      }

      this.spiceConn = new SpiceMainConn(spiceOpts)
      this.setState({
        loading: false
      })
    } catch (e) {
      console.error('[SPICE-CLIENT] Connection failed:', e)
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
    }
  }

  handleReInit = () => {
    console.debug('[SPICE-CLIENT] handleReInit called')
    this.cleanup()
    this.props.reloadTab(
      this.props.tab
    )
  }

  handleSendCtrlAltDel = () => {
    if (this.spiceConn) {
      try {
        this.spiceConn.sendCtrlAltDel()
        console.debug('[SPICE-CLIENT] Sent Ctrl+Alt+Del')
      } catch (err) {
        console.error('[SPICE-CLIENT] Failed to send Ctrl+Alt+Del:', err)
      }
    }
  }

  renderInfo () {
    const {
      host,
      port,
      username
    } = this.props.tab
    return (
      <span className='mg2l mg2r'>
        {username}@{host}:{port}
      </span>
    )
  }

  render () {
    const { width: w, height: h } = this.props
    const { loading } = this.state
    const { width: innerWidth, height: innerHeight } = this.calcCanvasSize()
    const wrapperStyle = {
      width: innerWidth + 'px',
      height: innerHeight + 'px',
      overflow: 'hidden'
    }
    const contrlProps = this.getControlProps()
    return (
      <Spin spinning={loading}>
        <div
          className='rdp-session-wrap session-v-wrap'
          style={{
            width: w + 'px',
            height: h + 'px'
          }}
        >
          {this.renderControl()}
          <RemoteFloatControl {...contrlProps} />
          <div
            style={wrapperStyle}
            className='spice-scroll-wrapper'
          >
            <div
              ref={this.domRef}
              className='spice-session-wrap session-v-wrap'
              style={{
                width: '100%',
                height: '100%'
              }}
            />
          </div>
        </div>
      </Spin>
    )
  }
}

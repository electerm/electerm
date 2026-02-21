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
  const mod = await import('@spice-project/spice-html5')
  window.spiceHtml5 = {
    SpiceMainConn: mod.SpiceMainConn,
    sendCtrlAltDel: mod.sendCtrlAltDel
  }
}

export default class SpiceSession extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      loading: false,
      connected: false
    }
    this.spiceConn = null
    this.screenId = `spice-screen-${props.tab.id}`
  }

  domRef = createRef()

  componentDidMount () {
    this.remoteInit()
  }

  componentWillUnmount () {
    this.cleanup()
  }

  cleanup = () => {
    if (this.spiceConn) {
      try {
        this.spiceConn.stop()
      } catch (e) {}
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

    const r = await createTerm(opts)
      .catch(err => {
        const text = err.message
        handleErr({ message: text })
      })
    if (!r) {
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
      return
    }

    const { pid, port } = r
    this.pid = pid

    try {
      await loadSpiceModule()
    } catch (e) {
      console.error('[SPICE] Failed to load SPICE module:', e)
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
      return
    }

    this.setStatus(statusMap.success)

    const { width, height } = this.calcCanvasSize()
    const wsUrl = this.buildWsUrl(port, 'spice', `&width=${width}&height=${height}`)

    try {
      const SpiceMainConn = window.spiceHtml5.SpiceMainConn
      const spiceOpts = {
        uri: wsUrl,
        password: password || '',
        screen_id: this.screenId,
        onsuccess: () => {
          this.setState({
            loading: false,
            connected: true
          })
          this.setStatus(statusMap.success)
        },
        onerror: (e) => {
          console.error('[SPICE] Connection error:', e)
          this.setState({ loading: false })
          this.setStatus(statusMap.error)
        },
        onagent: () => {}
      }

      this.spiceConn = new SpiceMainConn(spiceOpts)

      this.setState({
        loading: false
      })
    } catch (e) {
      console.error('[SPICE] Connection failed:', e)
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
    }
  }

  handleReInit = () => {
    this.cleanup()
    this.props.reloadTab(
      this.props.tab
    )
  }

  handleSendCtrlAltDel = () => {
    if (this.spiceConn && window.spiceHtml5?.sendCtrlAltDel) {
      try {
        window.spiceHtml5.sendCtrlAltDel(this.spiceConn)
      } catch (err) {
        console.error('[SPICE] Failed to send Ctrl+Alt+Del:', err)
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
              id={this.screenId}
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

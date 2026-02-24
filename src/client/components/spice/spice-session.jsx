import { PureComponent, createRef } from 'react'
import { createTerm } from '../terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import clone from '../../common/to-simple-obj'
import { handleErr } from '../../common/fetch'
import {
  statusMap
} from '../../common/constants'
import {
  ReloadOutlined
} from '@ant-design/icons'
import {
  Spin,
  Switch
} from 'antd'
import * as ls from '../../common/safe-local-storage'
import RemoteFloatControl from '../common/remote-float-control'
import './spice.styl'

async function loadSpiceModule () {
  if (window.spiceHtml5) return
  const mod = await import('spice-client')
  window.spiceHtml5 = {
    SpiceMainConn: mod.SpiceMainConn,
    sendCtrlAltDel: mod.sendCtrlAltDel
  }
}

export default class SpiceSession extends PureComponent {
  constructor (props) {
    const scaleViewportId = `spice-scale-view-${props.tab.host}`
    const scaleViewport = ls.getItemJSON(scaleViewportId, false)
    super(props)
    this.state = {
      loading: false,
      connected: false,
      scaleViewport
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

  handleSendCtrlAltDel = () => {
    if (this.spiceConn && window.spiceHtml5?.sendCtrlAltDel) {
      window.spiceHtml5.sendCtrlAltDel(this.spiceConn)
    }
  }

  handleScaleViewChange = (v) => {
    const scaleViewportId = `spice-scale-view-${this.props.tab.host}`
    ls.setItemJSON(scaleViewportId, v)
    this.setState({
      scaleViewport: v
    })
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
    const scaleProps = {
      checked: this.state.scaleViewport,
      onChange: this.handleScaleViewChange,
      unCheckedChildren: window.translate('scaleViewport'),
      checkedChildren: window.translate('scaleViewport'),
      className: 'mg1l'
    }
    return (
      <div className='pd1 fix session-v-info'>
        <div className='fleft'>
          <ReloadOutlined
            onClick={this.handleReInit}
            className='mg2r mg1l pointer'
          />
          {this.renderInfo()}
          <Switch
            {...scaleProps}
          />
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
    const { loading, scaleViewport } = this.state
    const { width: innerWidth, height: innerHeight } = this.calcCanvasSize()
    const wrapperStyle = {
      width: innerWidth + 'px',
      height: innerHeight + 'px',
      overflow: scaleViewport ? 'hidden' : 'auto'
    }
    const cls = `spice-session-wrap session-v-wrap${scaleViewport ? ' scale-viewport' : ''}`
    const contrlProps = this.getControlProps()
    return (
      <Spin spinning={loading}>
        <div
          className={cls}
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
            />
          </div>
        </div>
      </Spin>
    )
  }
}

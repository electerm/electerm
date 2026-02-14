import { PureComponent, createRef } from 'react'
import { createTerm } from '../terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import clone from '../../common/to-simple-obj'
import { handleErr } from '../../common/fetch'
import {
  statusMap
} from '../../common/constants'
import {
  Spin,
  Select
} from 'antd'
import {
  ReloadOutlined
} from '@ant-design/icons'
import message from '../common/message'
import Modal from '../common/modal'
import { copy } from '../../common/clipboard'
import RFB from '@novnc/novnc/core/rfb'
import VncForm from './vnc-form'
import RemoteFloatControl from '../common/remote-float-control'

const { Option } = Select
const e = window.translate

export default class VncSession extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      types: [],
      showConfirm: false,
      loading: false,
      name: '',
      screens: [],
      currentScreen: '0'
    }
  }

  domRef = createRef()

  componentDidMount () {
    this.remoteInit()
  }

  componentWillUnmount () {
    this.rfb && this.rfb.disconnect()
    delete this.rfb
    clearTimeout(this.timer)
  }

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
  }

  getScreenSize = () => {
    const { screens, currentScreen } = this.state
    const currentScreenData = screens.find(s => s.id === currentScreen)
    return {
      remoteWidth: currentScreenData ? currentScreenData.width : null,
      remoteHeight: currentScreenData ? currentScreenData.height : null
    }
  }

  calcCanvasSize = () => {
    const { width, height } = this.props
    return {
      width: width - 10,
      height: height - 80
    }
  }

  buildWsUrl = (port, type = 'rdp', extra = '') => {
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

  renderControl = () => {
    return (
      <div className='pd1 fix session-v-info'>
        <div className='fleft'>
          <ReloadOutlined
            onClick={this.handleReInit}
            className='mg2r mg1l pointer'
          />
          {this.renderScreensSelect()}
          {this.renderInfo()}
        </div>
        <div className='fright'>
          {this.props.fullscreenIcon()}
        </div>
      </div>
    )
  }

  renderScreensSelect = () => {
    const {
      screens,
      currentScreen
    } = this.state
    if (screens.length <= 1) {
      return null
    }
    return (
      <Select
        value={currentScreen}
        onChange={this.handleSelectScreen}
        className='mg2r'
        popupMatchSelectWidth={false}
      >
        {
          screens.map(s => (
            <Option key={s.id} value={s.id}>{s.name}</Option>
          ))
        }
      </Select>
    )
  }

  remoteInit = async (term = this.term) => {
    this.setState({
      loading: true
    })
    const { config } = this.props
    const { id } = this.props
    const tab = window.store.applyProfile(deepCopy(this.props.tab || {}))
    const {
      type,
      term: terminalType,
      viewOnly = false,
      scaleViewport = true,
      clipViewport = false,
      username,
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
    this.setState({
      loading: false
    })
    if (!r) {
      this.setStatus(statusMap.error)
      return
    }
    this.setStatus(statusMap.success)
    const { pid, port } = r
    this.pid = pid
    this.port = port
    const { width, height } = this.calcCanvasSize()
    const wsUrl = this.buildWsUrl(port, 'vnc', `&width=${width}&height=${height}`)
    // When scaleViewport is false, we don't set fixed dimensions on the canvas
    // so it can render at the actual remote screen size
    const vncOpts = {
      clipViewport,
      scaleViewport,
      viewOnly,
      style: scaleViewport
        ? {
            width: width + 'px',
            height: height + 'px',
            overflow: 'hidden'
          }
        : {},
      credentials: {}
    }
    if (username) {
      vncOpts.credentials.username = username
    }
    if (password) {
      vncOpts.credentials.password = password
    }
    const rfb = new RFB(
      this.getDom(),
      wsUrl,
      vncOpts
    )

    // Monkey patch _handleExtendedDesktopSize to capture screen info
    const originalHandleExtendedDesktopSize = rfb._handleExtendedDesktopSize
    rfb._handleExtendedDesktopSize = function () {
      try {
        // Wait for header
        if (this._sock.rQwait('ExtendedDesktopSize', 4)) {
          return false
        }

        const numberOfScreens = this._sock.rQpeek8()
        const bytes = 4 + (numberOfScreens * 16)
        if (this._sock.rQwait('ExtendedDesktopSize', bytes)) {
          return false
        }

        const firstUpdate = !this._supportsSetDesktopSize
        this._supportsSetDesktopSize = true

        if (firstUpdate) {
          this._requestRemoteResize()
        }

        const num = this._sock.rQshift8() // number-of-screens
        this._sock.rQskipBytes(3) // padding

        const screens = []
        for (let i = 0; i < num; i += 1) {
          const idBytes = this._sock.rQshiftBytes(4)
          const id = (idBytes[0] << 24 | idBytes[1] << 16 | idBytes[2] << 8 | idBytes[3]) >>> 0

          const x = this._sock.rQshift16() // x-position
          const y = this._sock.rQshift16() // y-position
          const w = this._sock.rQshift16() // width
          const h = this._sock.rQshift16() // height

          const flagsBytes = this._sock.rQshiftBytes(4)
          const flags = (flagsBytes[0] << 24 | flagsBytes[1] << 16 | flagsBytes[2] << 8 | flagsBytes[3]) >>> 0

          screens.push({ id, x, y, width: w, height: h, flags })

          if (i === 0) {
            this._screenID = idBytes
            this._screenFlags = flagsBytes
          }
        }

        // Store the screens in a custom property and dispatch event
        this.screens = screens
        this.dispatchEvent(new CustomEvent('screens', { detail: screens }))

        // Handle the resize feedback logic from original code
        if (this._FBU.x === 1 && this._FBU.y !== 0) {
          let msg = ''
          switch (this._FBU.y) {
            case 1: msg = 'Resize is administratively prohibited'; break
            case 2: msg = 'Out of resources'; break
            case 3: msg = 'Invalid screen layout'; break
            default: msg = 'Unknown reason'; break
          }
          console.warn('Server did not accept the resize request: ' + msg)
        } else {
          this._resize(this._FBU.width, this._FBU.height)
        }

        return true
      } catch (e) {
        console.error('Error in patched _handleExtendedDesktopSize', e)
        return originalHandleExtendedDesktopSize.call(this)
      }
    }

    // Monkey patch autoscale to support single screen scaling
    const originalAutoscale = rfb._display.autoscale
    rfb._display.autoscale = (containerWidth, containerHeight) => {
      const { currentScreen, screens } = this.state

      if (currentScreen === 'all' || !screens.length) {
        return originalAutoscale.call(rfb._display, containerWidth, containerHeight)
      }

      const screen = screens.find(s => s.id === currentScreen)
      if (!screen) {
        return originalAutoscale.call(rfb._display, containerWidth, containerHeight)
      }

      let scaleRatio = 1.0
      if (containerWidth > 0 && containerHeight > 0) {
        const targetAspectRatio = containerWidth / containerHeight
        const screenAspectRatio = screen.width / screen.height

        if (screenAspectRatio >= targetAspectRatio) {
          scaleRatio = containerWidth / screen.width
        } else {
          scaleRatio = containerHeight / screen.height
        }
      }
      rfb._display._rescale(scaleRatio)
    }

    const events = [
      'connect',
      'disconnect',
      'credentialsrequired',
      'securityfailure',
      'clipboard',
      'bell',
      'desktopname',
      'capabilities',
      'screens',
      'desktopsize'
    ]
    for (const event of events) {
      rfb.addEventListener(event, this[`on${window.capitalizeFirstLetter(event)}`])
    }
    rfb.scaleViewport = scaleViewport
    rfb.clipViewport = clipViewport
    this.rfb = rfb
  }

  onConnect = (event) => {
    this.setStatus(statusMap.success)
    // Capture the remote desktop size from the RFB connection
    this.setState({
      loading: false
    })
  }

  onDesktopsize = (event) => {
  }

  onDisconnect = () => {
    this.setStatus(statusMap.error)
  }

  onSecurityfailure = (event) => {
    message.error('Security Failure: ' + event.detail?.reason)
  }

  onOk = (res) => {
    this.setState({
      showConfirm: false
    })
    this.rfb?.sendCredentials(res)
  }

  onCredentialsrequired = (event) => {
    this.setState({
      types: event.detail?.types || [],
      showConfirm: true
    })
  }

  renderForm (types = this.state.types) {
    return (
      <VncForm
        types={types}
        handleFinish={this.onOk}
      />
    )
  }

  onClipboard = (event) => {
    copy(event.detail.text)
  }

  onBell = (event) => {
    message.warning('Bell')
  }

  onDesktopname = (event) => {
    this.setState({
      name: event?.detail?.name || ''
    })
    this.checkScreens()
  }

  onCapabilities = (capabilities) => {
    setTimeout(this.checkScreens, 1000)
  }

  processScreens = (screens) => {
    if (!screens || !screens.length) {
      return []
    }
    return screens.map((s, i) => ({
      name: `Screen ${i + 1}`,
      ...s,
      id: s.id !== undefined ? s.id : i
    }))
  }

  onScreens = (event) => {
    const screensData = event.detail
    if (screensData && screensData.length) {
      const screens = this.processScreens(screensData)
      this.setState({
        screens,
        currentScreen: screens[0].id
      })
    }
  }

  checkScreens = () => {
    // Attempt to detect screens from noVNC
    let screens = this.rfb?.screens
    if (!screens && this.rfb?.capabilities?.screens) {
      screens = this.rfb.capabilities.screens
    }

    if (screens && screens.length) {
      this.setState({
        screens: this.processScreens(screens)
      })
    }
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      prevProps.width !== this.props.width ||
      prevProps.height !== this.props.height ||
      prevState.currentScreen !== this.state.currentScreen
    ) {
      this.updateViewLayout()
    }
  }

  updateViewLayout = () => {
    const { currentScreen, screens } = this.state
    const { scaleViewport = true, clipViewport = false } = this.props.tab
    const container = this.domRef.current ? this.domRef.current.firstElementChild : null

    if (!this.rfb || !container) {
      return
    }

    // Force re-apply scaleViewport to trigger autoscale logic (if enabled)
    // or reset to 1.0 (if disabled)
    this.rfb.scaleViewport = scaleViewport
    this.rfb.clipViewport = clipViewport

    // Explicitly trigger autoscale to ensure our patched logic runs
    if (scaleViewport && this.rfb._display) {
      this.rfb._display.autoscale(container.clientWidth, container.clientHeight)
    }

    // Handle scrolling to the selected screen
    this.timer = setTimeout(() => {
      if (currentScreen === 'all') {
        container.scrollTo(0, 0)
      } else {
        const screen = screens.find(s => s.id === currentScreen)
        if (screen) {
          const scale = this.rfb._display.scale
          container.scrollTo(screen.x * scale, screen.y * scale)
        }
      }
    }, 50)
  }

  handleSelectScreen = (id) => {
    this.setState({
      currentScreen: id
    })
    // updateViewLayout will be called by componentDidUpdate
  }

  getDom = () => {
    return this.domRef.current
  }

  handleReInit = () => {
    this.rfb?.disconnect()
    delete this.rfb
    this.remoteInit()
  }

  renderInfo () {
    const {
      name
    } = this.state
    const {
      host,
      port,
      username
    } = this.props.tab
    return (
      <span className='mg2l mg2r'>
        <b>{name}</b> {username}@{host}:{port}
      </span>
    )
  }

  handleSendCtrlAltDel = () => {
    this.rfb?.sendCtrlAltDel()
  }

  renderConfirm () {
    const {
      showConfirm
    } = this.state
    if (!showConfirm) {
      return null
    }
    const confirmProps = {
      title: e('credentialsRequired'),
      content: this.renderForm(['password']),
      footer: null,
      open: true
    }
    return (
      <Modal
        {...confirmProps}
      >
        {this.renderForm()}
      </Modal>
    )
  }

  render () {
    const { width: w, height: h } = this.props
    const { loading, screens } = this.state
    const { remoteWidth, remoteHeight } = this.getScreenSize()
    const { scaleViewport = true } = this.props.tab
    // When not in scale mode, we need a wrapper with container size,
    // and the inner div should have remote screen size to show scrollbars
    const isScaled = scaleViewport

    const {
      width: innerWidth,
      height: innerHeight
    } = this.calcCanvasSize()
    const wrapperStyle = {
      width: innerWidth + 'px',
      height: innerHeight + 'px',
      overflow: isScaled ? 'hidden' : 'auto'
    }
    const remoteStyle = {
      width: isScaled ? '100%' : remoteWidth + 'px',
      height: isScaled ? '100%' : remoteHeight + 'px',
      overflow: 'hidden'
    }
    const divProps = {
      style: remoteStyle,
      className: 'vnc-session-wrap session-v-wrap'
    }
    const contrlProps = {
      isFullScreen: this.props.fullscreen,
      onSendCtrlAltDel: this.handleSendCtrlAltDel,
      screens: screens.length > 1 ? screens : [],
      currentScreen: this.state.currentScreen,
      onSelectScreen: this.handleSelectScreen
    }
    return (
      <Spin spinning={loading}>
        <div
          className='rdp-session-wrap pd1'
          style={{
            width: w + 'px',
            height: h + 'px'
          }}
        >
          {this.renderControl()}
          <RemoteFloatControl
            {...contrlProps}
          />
          <div
            style={wrapperStyle}
            className='vnc-scroll-wrapper'
          >
            <div
              {...divProps}
              ref={this.domRef}
            />
          </div>
          {this.renderConfirm()}
        </div>
      </Spin>
    )
  }
}

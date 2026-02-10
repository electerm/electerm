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
  ReloadOutlined,
  EditOutlined
} from '@ant-design/icons'
import * as ls from '../../common/safe-local-storage'
import scanCode from './code-scan'
import resolutions from './resolutions'

const { Option } = Select

// IronRDP WASM module imports — loaded dynamically
let wasmInit = null
let wasmSetup = null
let SessionBuilder = null
let DesktopSize = null
let InputTransaction = null
let DeviceEvent = null
let Extension = null
let wasmInitialized = false

async function loadWasmModule () {
  if (wasmInitialized) return
  console.debug('[RDP-CLIENT] Loading IronRDP WASM module...')
  const mod = await import('ironrdp-wasm')
  wasmInit = mod.default
  wasmSetup = mod.setup
  SessionBuilder = mod.SessionBuilder
  DesktopSize = mod.DesktopSize
  InputTransaction = mod.InputTransaction
  DeviceEvent = mod.DeviceEvent
  Extension = mod.Extension
  await wasmInit()
  wasmSetup('info')
  wasmInitialized = true
  console.debug('[RDP-CLIENT] IronRDP WASM module loaded and initialized')
}

export default class RdpSession extends PureComponent {
  constructor (props) {
    const id = `rdp-reso-${props.tab.host}`
    const resObj = ls.getItemJSON(id, resolutions[0])
    super(props)
    this.canvasRef = createRef()
    this.state = {
      loading: false,
      ...resObj
    }
    this.session = null
  }

  componentDidMount () {
    this.remoteInit()
  }

  componentWillUnmount () {
    this.cleanup()
  }

  cleanup = () => {
    console.debug('[RDP-CLIENT] cleanup() called')
    if (this.session) {
      try {
        this.session.shutdown()
        console.debug('[RDP-CLIENT] session.shutdown() called')
      } catch (e) {
        console.debug('[RDP-CLIENT] session.shutdown() error:', e)
      }
      this.session = null
    }
  }

  runInitScript = () => {}

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
  }

  remoteInit = async () => {
    this.setState({
      loading: true
    })
    const { config } = this.props
    const {
      host,
      tokenElecterm,
      server = ''
    } = config
    const { id } = this.props
    const tab = window.store.applyProfile(deepCopy(this.props.tab || {}))
    const {
      type,
      term: terminalType
    } = tab
    const opts = clone({
      term: terminalType || config.terminalType,
      tabId: id,
      uid: tab.id,
      srcTabId: tab.id,
      termType: type,
      ...tab
    })

    console.debug('[RDP-CLIENT] Creating RDP session term, host=', tab.host, 'port=', tab.port)
    const r = await createTerm(opts)
      .catch(err => {
        const text = err.message
        handleErr({ message: text })
      })
    if (!r) {
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
      console.error('[RDP-CLIENT] createTerm failed')
      return
    }

    const {
      pid, port
    } = r
    this.pid = pid
    console.debug('[RDP-CLIENT] Term created, pid=', pid, 'port=', port)

    // Build the WebSocket proxy address for IronRDP WASM
    const hs = server
      ? server.replace(/https?:\/\//, '')
      : `${host}:${port}`
    const pre = server.startsWith('https') ? 'wss' : 'ws'
    const { width, height } = this.state
    // IronRDP connects to the proxy address, which then proxies via RDCleanPath
    // The WebSocket URL includes the pid and token for auth
    const proxyAddress = `${pre}://${hs}/rdp/${pid}?token=${tokenElecterm}&width=${width}&height=${height}`
    console.debug('[RDP-CLIENT] Proxy address:', proxyAddress)

    // Load WASM module if not already loaded
    try {
      await loadWasmModule()
    } catch (e) {
      console.error('[RDP-CLIENT] Failed to load WASM module:', e)
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
      return
    }

    this.setStatus(statusMap.success)

    // Connect using IronRDP SessionBuilder
    try {
      const canvas = this.canvasRef.current
      if (!canvas) {
        console.error('[RDP-CLIENT] Canvas ref not available')
        this.setState({ loading: false })
        return
      }

      const rdpHost = tab.host
      const rdpPort = tab.port || 3389
      const destination = `${rdpHost}:${rdpPort}`
      const username = tab.username || ''
      const password = tab.password || ''

      console.debug('[RDP-CLIENT] Building IronRDP session...')
      console.debug('[RDP-CLIENT] destination:', destination)
      console.debug('[RDP-CLIENT] username:', username)
      console.debug('[RDP-CLIENT] proxyAddress:', proxyAddress)
      console.debug('[RDP-CLIENT] desktopSize:', width, 'x', height)

      const desktopSize = new DesktopSize(width, height)
      const enableCredsspExt = new Extension('enable_credssp', false)

      const builder = new SessionBuilder()
      builder.username(username)
      builder.password(password)
      builder.destination(destination)
      builder.proxyAddress(proxyAddress)
      builder.authToken('none')
      builder.desktopSize(desktopSize)
      builder.renderCanvas(canvas)
      builder.extension(enableCredsspExt)

      // Cursor style callback
      builder.setCursorStyleCallbackContext(canvas)
      builder.setCursorStyleCallback(function (style) {
        canvas.style.cursor = style || 'default'
      })

      console.debug('[RDP-CLIENT] Calling builder.connect()...')
      this.session = await builder.connect()

      const ds = this.session.desktopSize()
      console.debug('[RDP-CLIENT] Connected! Desktop:', ds.width, 'x', ds.height)

      // Update canvas size to match actual desktop size
      canvas.width = ds.width
      canvas.height = ds.height

      this.setState({
        loading: false
      })

      canvas.focus()

      // Run the session event loop (renders frames, handles protocol)
      console.debug('[RDP-CLIENT] Starting session.run() event loop')
      this.session.run().then((info) => {
        console.debug('[RDP-CLIENT] Session ended:', info.reason())
        this.onSessionEnd()
      }).catch((e) => {
        console.error('[RDP-CLIENT] Session error:', this.formatError(e))
        this.onSessionEnd()
      })
    } catch (e) {
      console.error('[RDP-CLIENT] Connection failed:', this.formatError(e))
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
    }
  }

  formatError = (e) => {
    if (e && typeof e === 'object' && '__wbg_ptr' in e) {
      try {
        const kindNames = {
          0: 'General',
          1: 'WrongPassword',
          2: 'LogonFailure',
          3: 'AccessDenied',
          4: 'RDCleanPath',
          5: 'ProxyConnect',
          6: 'NegotiationFailure'
        }
        const kind = e.kind ? e.kind() : 'Unknown'
        const bt = e.backtrace ? e.backtrace() : ''
        return `[${kindNames[kind] || kind}] ${bt}`
      } catch (_) {}
    }
    return e?.message || e?.toString() || String(e)
  }

  onSessionEnd = () => {
    console.debug('[RDP-CLIENT] onSessionEnd called')
    this.session = null
    this.setStatus(statusMap.error)
  }

  setupInputHandlers = () => {
    const canvas = this.canvasRef.current
    if (!canvas || this._inputHandlersSetup) return
    this._inputHandlersSetup = true
    console.debug('[RDP-CLIENT] Setting up input handlers')

    canvas.addEventListener('keydown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!this.session) return
      const scancode = this.getScancode(e.code)
      if (scancode === null) return
      try {
        const event = DeviceEvent.keyPressed(scancode)
        const tx = new InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        console.error('[RDP-CLIENT] Key press error:', err)
      }
    })

    canvas.addEventListener('keyup', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!this.session) return
      const scancode = this.getScancode(e.code)
      if (scancode === null) return
      try {
        const event = DeviceEvent.keyReleased(scancode)
        const tx = new InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        console.error('[RDP-CLIENT] Key release error:', err)
      }
    })

    canvas.addEventListener('mousemove', (e) => {
      if (!this.session) return
      try {
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        const x = Math.round((e.clientX - rect.left) * scaleX)
        const y = Math.round((e.clientY - rect.top) * scaleY)
        const event = DeviceEvent.mouseMove(x, y)
        const tx = new InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        // suppress frequent mouse errors
      }
    })

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault()
      canvas.focus()
      if (!this.session) return
      try {
        const event = DeviceEvent.mouseButtonPressed(e.button)
        const tx = new InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        console.error('[RDP-CLIENT] Mouse down error:', err)
      }
    })

    canvas.addEventListener('mouseup', (e) => {
      e.preventDefault()
      if (!this.session) return
      try {
        const event = DeviceEvent.mouseButtonReleased(e.button)
        const tx = new InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        console.error('[RDP-CLIENT] Mouse up error:', err)
      }
    })

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      if (!this.session) return
      try {
        if (e.deltaY !== 0) {
          const amount = e.deltaY > 0 ? -1 : 1
          const event = DeviceEvent.wheelRotations(true, amount, 1)
          const tx = new InputTransaction()
          tx.addEvent(event)
          this.session.applyInputs(tx)
        }
        if (e.deltaX !== 0) {
          const amount = e.deltaX > 0 ? -1 : 1
          const event = DeviceEvent.wheelRotations(false, amount, 1)
          const tx = new InputTransaction()
          tx.addEvent(event)
          this.session.applyInputs(tx)
        }
      } catch (err) {
        console.error('[RDP-CLIENT] Wheel error:', err)
      }
    }, { passive: false })

    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  // Get PS/2 scancode from keyboard event code using existing code-scan module
  getScancode = (code) => {
    const sc = scanCode({ code })
    return sc !== undefined ? sc : null
  }

  handleEditResolutions = () => {
    window.store.toggleResolutionEdit()
  }

  handleReInit = () => {
    console.debug('[RDP-CLIENT] handleReInit called')
    this.cleanup()
    this.props.reloadTab(
      this.props.tab
    )
  }

  handleReload = () => {
    this.props.reloadTab(
      this.props.tab
    )
  }

  getAllRes = () => {
    return [
      ...this.props.resolutions,
      ...resolutions
    ]
  }

  handleResChange = (v) => {
    const res = this.getAllRes().find(d => d.id === v)
    const id = `rdp-reso-${this.props.tab.host}`
    ls.setItemJSON(id, res)
    this.setState(res, this.handleReInit)
  }

  renderHelp = () => {
    return null
  }

  renderControl = () => {
    const {
      id
    } = this.state
    const sleProps = {
      value: id,
      onChange: this.handleResChange,
      popupMatchSelectWidth: false
    }
    return (
      <div className='pd1 fix session-v-info'>
        <div className='fleft'>
          <ReloadOutlined
            onClick={this.handleReInit}
            className='mg2r mg1l pointer'
          />
          <Select
            {...sleProps}
          >
            {
              this.getAllRes().map(d => {
                const v = d.id
                return (
                  <Option
                    key={v}
                    value={v}
                  >
                    {d.width}x{d.height}
                  </Option>
                )
              })
            }
          </Select>
          <EditOutlined
            onClick={this.handleEditResolutions}
            className='mg2r mg1l pointer'
          />
          {this.renderInfo()}
          {this.renderHelp()}
        </div>
        <div className='fright'>
          {this.props.fullscreenIcon()}
        </div>
      </div>
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

  componentDidUpdate () {
    // Set up native input handlers after canvas is rendered
    this.setupInputHandlers()
  }

  render () {
    const { width: w, height: h } = this.props
    const rdpProps = {
      style: {
        width: w + 'px',
        height: h + 'px'
      }
    }
    const { width, height, loading } = this.state
    const canvasProps = {
      width,
      height,
      tabIndex: 0
    }
    return (
      <Spin spinning={loading}>
        <div
          {...rdpProps}
          className='rdp-session-wrap session-v-wrap'
        >
          {this.renderControl()}
          <canvas
            {...canvasProps}
            ref={this.canvasRef}
          />
        </div>
      </Spin>
    )
  }
}

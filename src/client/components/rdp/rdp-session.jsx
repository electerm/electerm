import { PureComponent, createRef } from 'react'
import { createTerm } from '../terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import clone from '../../common/to-simple-obj'
import { handleErr } from '../../common/fetch'
import {
  statusMap
} from '../../common/constants'
import {
  ReloadOutlined,
  EditOutlined,
  UploadOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import {
  Spin,
  Select,
  Switch,
  Tooltip
} from 'antd'
import * as ls from '../../common/safe-local-storage'
import scanCode from './code-scan'
import resolutions from './resolutions'
import { readClipboardAsync } from '../../common/clipboard'
import RemoteFloatControl from '../common/remote-float-control'
import HelpIcon from '../common/help-icon'
import { FileTransferManager, createFileLogger } from './file-transfer'
import { notification } from '../common/notification'
import message from '../common/message'
import ShowItem from '../common/show-item'
import './rdp.styl'

const { Option } = Select

async function loadWasmModule () {
  if (window.ironRdp) return
  console.debug('[RDP-CLIENT] Loading IronRDP WASM module...')
  const mod = await import('ironrdp-wasm')
  window.ironRdp = {
    wasmInit: mod.default,
    wasmSetup: mod.setup,
    SessionBuilder: mod.SessionBuilder,
    DesktopSize: mod.DesktopSize,
    InputTransaction: mod.InputTransaction,
    DeviceEvent: mod.DeviceEvent,
    Extension: mod.Extension,
    ClipboardData: mod.ClipboardData
  }
  await window.ironRdp.wasmInit()
  window.ironRdp.wasmSetup('info')
  console.debug('[RDP-CLIENT] IronRDP WASM module loaded and initialized')
}

export default class RdpSession extends PureComponent {
  constructor (props) {
    const id = `rdp-reso-${props.tab.host}`
    const resObj = ls.getItemJSON(id, resolutions[1])
    const scaleViewportId = `rdp-scale-view-${props.tab.host}`
    const scaleViewport = ls.getItemJSON(scaleViewportId, false)
    super(props)
    this.canvasRef = createRef()
    this.state = {
      loading: false,
      scaleViewport,
      ...resObj,
      hasRemoteFiles: false,
      downloadBtnDisabled: true,
      uploadReady: false
    }
    this.session = null
    this.fileTransfer = null
    this.fileUploadInProgress = false
    this.log = createFileLogger()
  }

  componentDidMount () {
    this.remoteInit()
  }

  componentWillUnmount () {
    this.cleanup()
  }

  cleanup = () => {
    if (this.session) {
      try {
        this.session.shutdown()
      } catch (e) {
        this.log(`session.shutdown() error: ${e.message}`, 'error')
      }
      this.session = null
    }
    if (this.fileTransfer) {
      this.fileTransfer.cleanup()
      this.fileTransfer = null
    }
  }

  runInitScript = () => { }

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
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

  remoteInit = async () => {
    this.setState({
      loading: true
    })
    const { config } = this.props
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

    const {
      pid, port
    } = r
    this.pid = pid

    const { width, height } = this.state
    const extra = `&width=${width}&height=${height}`
    const proxyAddress = this.buildWsUrl(port, 'rdp', extra)

    try {
      await loadWasmModule()
    } catch (e) {
      this.log(`Failed to load WASM module: ${e.message}`, 'error')
      this.setState({ loading: false })
      this.setStatus(statusMap.error)
      return
    }

    this.setStatus(statusMap.success)

    try {
      const canvas = this.canvasRef.current
      if (!canvas) {
        this.log('Canvas ref not available', 'error')
        this.setState({ loading: false })
        return
      }

      const rdpHost = tab.host
      const rdpPort = tab.port || 3389
      const destination = `${rdpHost}:${rdpPort}`
      const username = tab.username || ''
      const password = tab.password || ''

      const desktopSize = new window.ironRdp.DesktopSize(width, height)
      const enableCredsspExt = new window.ironRdp.Extension('enable_credssp', true)

      const builder = new window.ironRdp.SessionBuilder()
      builder.username(username)
      builder.password(password)
      builder.destination(destination)
      builder.proxyAddress(proxyAddress)
      builder.authToken('none')
      builder.desktopSize(desktopSize)
      builder.renderCanvas(canvas)
      builder.extension(enableCredsspExt)

      this.fileTransfer = new FileTransferManager(
        () => this.session,
        this.log,
        (inProgress) => {
          this.fileUploadInProgress = inProgress
        },
        () => {
          this.setState({ uploadReady: false })
        },
        (filePath, fileName, fileSize) => {
          notification.success({
            message: 'File downloaded from remote',
            description: (
              <ShowItem to={filePath}>
                {`${fileName} (${this.fileTransfer.formatFileSize(fileSize)})`}
              </ShowItem>
            ),
            duration: 0
          })
        }
      )

      this.fileTransfer.setStateChangeCallback((state) => {
        this.setState({
          hasRemoteFiles: state.hasRemoteFiles,
          downloadBtnDisabled: !state.hasRemoteFiles
        })
      })

      const fileTransferExtensions = this.fileTransfer.createExtensions()
      fileTransferExtensions.forEach((ext) => {
        builder.extension(ext)
      })

      builder.remoteClipboardChangedCallback((clipboardData) => {
        try {
          if (clipboardData.isEmpty()) {
            return
          }
          const items = clipboardData.items()
          for (const item of items) {
            const mimeType = item.mimeType()
            if (mimeType === 'text/plain') {
              const text = item.value()
              window.pre.writeClipboard(text)
            }
          }
        } catch (e) {
          this.log(`Clipboard error: ${e.message}`, 'error')
        }
      })

      builder.forceClipboardUpdateCallback(() => {
        this.syncLocalToRemote()
      })

      builder.setCursorStyleCallbackContext(canvas)
      builder.setCursorStyleCallback(function (style) {
        canvas.style.cursor = style || 'default'
      })

      this.session = await builder.connect()

      const ds = this.session.desktopSize()

      canvas.width = ds.width
      canvas.height = ds.height

      this.setState({
        loading: false
      })

      canvas.focus()

      this.session.run().then((info) => {
        this.log(`Session ended: ${info.reason()}`, 'info')
        this.onSessionEnd()
      }).catch((e) => {
        this.log(`Session error: ${this.formatError(e)}`, 'error')
        this.onSessionEnd()
      })
    } catch (e) {
      this.log(`Connection failed: ${this.formatError(e)}`, 'error')
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
      } catch (_) { }
    }
    return e?.message || e?.toString() || String(e)
  }

  syncLocalToRemote = async () => {
    if (!this.session || this.fileUploadInProgress) {
      return
    }
    try {
      const text = await readClipboardAsync()
      if (text) {
        const data = new window.ironRdp.ClipboardData()
        data.addText('text/plain', text)
        await this.session.onClipboardPaste(data)
      }
    } catch (e) {
      this.log(`Local clipboard sync error: ${e.message}`, 'error')
    }
  }

  onSessionEnd = () => {
    this.session = null
    this.setStatus(statusMap.error)
  }

  setupInputHandlers = () => {
    const canvas = this.canvasRef.current
    if (!canvas || this._inputHandlersSetup) return
    this._inputHandlersSetup = true

    canvas.addEventListener('keydown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!this.session) return
      const scancode = this.getScancode(e.code)
      if (scancode === null) return
      try {
        const event = window.ironRdp.DeviceEvent.keyPressed(scancode)
        const tx = new window.ironRdp.InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        this.log(`Key press error: ${err.message}`, 'error')
      }
    })

    canvas.addEventListener('keyup', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!this.session) return
      const scancode = this.getScancode(e.code)
      if (scancode === null) return
      try {
        const event = window.ironRdp.DeviceEvent.keyReleased(scancode)
        const tx = new window.ironRdp.InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        this.log(`Key release error: ${err.message}`, 'error')
      }
    })

    canvas.addEventListener('mousemove', (e) => {
      if (!this.session) return
      try {
        const rect = canvas.getBoundingClientRect()
        const { scaleViewport } = this.state
        let scaleX = canvas.width / rect.width
        let scaleY = canvas.height / rect.height
        let offsetX = 0
        let offsetY = 0
        if (scaleViewport) {
          const containerRatio = rect.width / rect.height
          const canvasRatio = canvas.width / canvas.height
          let renderWidth, renderHeight
          if (containerRatio > canvasRatio) {
            renderHeight = rect.height
            renderWidth = rect.height * canvasRatio
            offsetX = (rect.width - renderWidth) / 2
          } else {
            renderWidth = rect.width
            renderHeight = rect.width / canvasRatio
            offsetY = (rect.height - renderHeight) / 2
          }
          scaleX = canvas.width / renderWidth
          scaleY = canvas.height / renderHeight
        }
        const x = Math.round((e.clientX - rect.left - offsetX) * scaleX)
        const y = Math.round((e.clientY - rect.top - offsetY) * scaleY)
        const event = window.ironRdp.DeviceEvent.mouseMove(x, y)
        const tx = new window.ironRdp.InputTransaction()
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
        const event = window.ironRdp.DeviceEvent.mouseButtonPressed(e.button)
        const tx = new window.ironRdp.InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        this.log(`Mouse down error: ${err.message}`, 'error')
      }
    })

    canvas.addEventListener('mouseup', (e) => {
      e.preventDefault()
      if (!this.session) return
      try {
        const event = window.ironRdp.DeviceEvent.mouseButtonReleased(e.button)
        const tx = new window.ironRdp.InputTransaction()
        tx.addEvent(event)
        this.session.applyInputs(tx)
      } catch (err) {
        this.log(`Mouse up error: ${err.message}`, 'error')
      }
    })

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      if (!this.session) return
      try {
        if (e.deltaY !== 0) {
          const amount = e.deltaY > 0 ? -1 : 1
          const event = window.ironRdp.DeviceEvent.wheelRotations(true, amount, 1)
          const tx = new window.ironRdp.InputTransaction()
          tx.addEvent(event)
          this.session.applyInputs(tx)
        }
        if (e.deltaX !== 0) {
          const amount = e.deltaX > 0 ? -1 : 1
          const event = window.ironRdp.DeviceEvent.wheelRotations(false, amount, 1)
          const tx = new window.ironRdp.InputTransaction()
          tx.addEvent(event)
          this.session.applyInputs(tx)
        }
      } catch (err) {
        this.log(`Wheel error: ${err.message}`, 'error')
      }
    }, { passive: false })

    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    canvas.addEventListener('paste', (e) => {
      e.preventDefault()
      this.handlePasteEvent()
    })

    canvas.addEventListener('focus', () => {
      this.syncLocalToRemote()
    })
  }

  getScancode = (code) => {
    const sc = scanCode({ code })
    return sc !== undefined ? sc : null
  }

  handleEditResolutions = () => {
    window.store.toggleResolutionEdit()
  }

  handleReInit = () => {
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
      ...resolutions.slice(1)
    ]
  }

  handleResChange = (v) => {
    const res = this.getAllRes().find(d => d.id === v)
    const id = `rdp-reso-${this.props.tab.host}`
    ls.setItemJSON(id, res)
    this.setState(res, this.handleReInit)
  }

  handleScaleViewChange = (v) => {
    const scaleViewportId = `rdp-scale-view-${this.props.tab.host}`
    ls.setItemJSON(scaleViewportId, v)
    this.setState({
      scaleViewport: v
    })
  }

  renderHelp = () => {
    return null
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
      onSelectScreen: () => { },
      fixedPosition,
      showExitFullscreen,
      className
    }
  }

  handleSendCtrlAltDel = () => {
    if (!this.session) return
    try {
      const tx = new window.ironRdp.InputTransaction()
      const ctrlScancode = 0x1D
      tx.addEvent(window.ironRdp.DeviceEvent.keyPressed(ctrlScancode))
      const altScancode = 0x38
      tx.addEvent(window.ironRdp.DeviceEvent.keyPressed(altScancode))
      const delScancode = 0x53
      tx.addEvent(window.ironRdp.DeviceEvent.keyPressed(delScancode))
      tx.addEvent(window.ironRdp.DeviceEvent.keyReleased(delScancode))
      tx.addEvent(window.ironRdp.DeviceEvent.keyReleased(altScancode))
      tx.addEvent(window.ironRdp.DeviceEvent.keyReleased(ctrlScancode))
      this.session.applyInputs(tx)
    } catch (err) {
      this.log(`Failed to send Ctrl+Alt+Del: ${err.message}`, 'error')
    }
  }

  handleUploadButtonClick = async () => {
    const properties = [
      'openFile',
      'multiSelections',
      'showHiddenFiles',
      'noResolveAliases',
      'treatPackageAsDirectory',
      'dontAddToRecent'
    ]

    const files = await window.api.openDialog({
      title: 'Choose files to upload to remote desktop',
      message: 'Choose files to upload',
      properties
    }).catch((err) => {
      this.log(`File dialog error: ${err.message}`, 'error')
      return false
    })

    if (!files || !files.length) {
      return
    }

    message.info('Ready to paste on remote to upload files', 5)
    this.setState({ uploadReady: true })

    if (this.fileTransfer) {
      await this.fileTransfer.uploadFromPaths(files)
    }
  }

  handleDownloadButtonClick = () => {
    if (this.fileTransfer) {
      this.fileTransfer.downloadFiles()
    }
  }

  handlePasteEvent = async () => {
    const text = await readClipboardAsync()

    if (!text) {
      this.syncLocalToRemote()
      return
    }

    const fileRegWin = /^\w:\\.+/
    const fileReg = /^\/.+/
    const lines = text.split('\n')

    const filePaths = lines.filter(line => fileReg.test(line) || fileRegWin.test(line))

    if (filePaths.length === 0) {
      this.syncLocalToRemote()
      return
    }

    if (this.fileTransfer) {
      await this.fileTransfer.uploadFromPaths(filePaths)
    }
  }

  componentDidUpdate () {
    this.setupInputHandlers()
  }

  renderControl = () => {
    const contrlProps = this.getControlProps({
      fixedPosition: false,
      showExitFullscreen: false,
      className: 'mg1l'
    })
    const {
      id,
      hasRemoteFiles,
      uploadReady
    } = this.state
    const sleProps = {
      value: id,
      onChange: this.handleResChange,
      popupMatchSelectWidth: false
    }
    const scaleProps = {
      checked: this.state.scaleViewport,
      onChange: this.handleScaleViewChange,
      unCheckedChildren: window.translate('scaleViewport'),
      checkedChildren: window.translate('scaleViewport'),
      className: 'mg1l'
    }
    const uploadTitle = window.translate('upload') || 'Upload files to remote'
    const downloadTitle = window.translate('download') || 'Download files from remote'
    return (
      <div
        className='pd1 fix session-v-info block'
      >
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
          <Switch
            {...scaleProps}
          />
          <Tooltip title={uploadTitle}>
            <UploadOutlined
              onClick={this.handleUploadButtonClick}
              className={`mg1r mg2l pointer rdp-file-transfer-btn${uploadReady ? ' rdp-download-flash' : ''}`}
            />
          </Tooltip>
          <Tooltip title={downloadTitle}>
            <DownloadOutlined
              onClick={this.handleDownloadButtonClick}
              className={`mg2r mg1l pointer rdp-file-transfer-btn${hasRemoteFiles ? ' rdp-download-flash' : ' rdp-download-disabled'}`}
            />
          </Tooltip>
          <HelpIcon
            link='https://github.com/electerm/electerm/wiki/RDP-File-Transfer'
            className='mg2r mg1l'
          />
        </div>
        <div className='fright'>
          {this.props.fullscreenIcon()}
          <RemoteFloatControl {...contrlProps} />
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

  render () {
    const { width: w, height: h } = this.props
    const { width, height, loading, scaleViewport } = this.state
    const innerWidth = w - 10
    const innerHeight = h - 80
    const wrapperStyle = {
      width: innerWidth + 'px',
      height: innerHeight + 'px',
      overflow: scaleViewport ? 'hidden' : 'auto'
    }
    const canvasProps = {
      width,
      height,
      tabIndex: 0
    }
    const cls = `rdp-session-wrap session-v-wrap${scaleViewport ? ' scale-viewport' : ''}`
    const sessProps = {
      className: cls,
      style: {
        width: w + 'px',
        height: h + 'px'
      }
    }
    const controlProps = this.getControlProps()
    return (
      <Spin spinning={loading}>
        <div
          {...sessProps}
        >
          {this.renderControl()}
          <RemoteFloatControl {...controlProps} />
          <div
            style={wrapperStyle}
            className='rdp-scroll-wrapper s-scroll-wrapper'
          >
            <canvas
              {...canvasProps}
              ref={this.canvasRef}
            />
          </div>
        </div>
      </Spin>
    )
  }
}

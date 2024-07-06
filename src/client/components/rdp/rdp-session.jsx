import { Component } from '../common/react-subx'
import { createTerm } from '../terminal/terminal-apis'
import deepCopy from 'json-deep-copy'
import clone from '../../common/to-simple-obj'
import { handleErr } from '../../common/fetch'
import {
  statusMap,
  rdpHelpLink
} from '../../common/constants'
import {
  notification,
  Spin,
  // Button,
  Select
} from 'antd'
import {
  ReloadOutlined,
  EditOutlined
} from '@ant-design/icons'
import HelpIcon from '../common/help-icon'
import * as ls from '../../common/safe-local-storage'
import scanCode from './code-scan'
import resolutions from './resolutions'

const { Option } = Select
// const { prefix } = window
// const e = prefix('ssh')
// const m = prefix('menu')

export default class RdpSession extends Component {
  constructor (props) {
    const id = `rdp-reso-${props.tab.host}`
    const resObj = ls.getItemJSON(id, resolutions[0])
    super(props)
    this.state = {
      loading: false,
      bitmapProps: {},
      aspectRatio: 4 / 3,
      ...resObj
    }
  }

  componentDidMount () {
    this.remoteInit()
  }

  componentWillUnmount () {
    this.socket && this.socket.close()
    delete this.socket
  }

  runInitScript = () => {

  }

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
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
      termType: type,
      ...tab
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
    this.pid = pid
    const hs = server
      ? server.replace(/https?:\/\//, '')
      : `${host}:${port}`
    const pre = server.startsWith('https') ? 'wss' : 'ws'
    const { width, height } = this.state
    const wsUrl = `${pre}://${hs}/rdp/${pid}?sessionId=${sessionId}&token=${tokenElecterm}&width=${width}&height=${height}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    this.socket = socket
    socket.onopen = this.runInitScript
    socket.onmessage = this.onData
  }

  decompress = (bitmap) => {
    let fName = null
    switch (bitmap.bitsPerPixel) {
      case 15:
        fName = 'bitmap_decompress_15'
        break
      case 16:
        fName = 'bitmap_decompress_16'
        break
      case 24:
        fName = 'bitmap_decompress_24'
        break
      case 32:
        fName = 'bitmap_decompress_32'
        break
      default:
        throw new Error('invalid bitmap data format')
    }
    const rle = window.Module
    const input = new Uint8Array(bitmap.data.data)
    const inputPtr = rle._malloc(input.length)
    const inputHeap = new Uint8Array(rle.HEAPU8.buffer, inputPtr, input.length)
    inputHeap.set(input)

    const outputWidth = bitmap.destRight - bitmap.destLeft + 1
    const outputHeight = bitmap.destBottom - bitmap.destTop + 1
    const ouputSize = outputWidth * outputHeight * 4
    const outputPtr = rle._malloc(ouputSize)

    const outputHeap = new Uint8Array(rle.HEAPU8.buffer, outputPtr, ouputSize)

    rle.ccall(fName,
      'number',
      ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [outputHeap.byteOffset, outputWidth, outputHeight, bitmap.width, bitmap.height, inputHeap.byteOffset, input.length]
    )

    const output = new Uint8ClampedArray(outputHeap.buffer, outputHeap.byteOffset, ouputSize)

    rle._free(inputPtr)
    rle._free(outputPtr)

    return { width: outputWidth, height: outputHeight, arr: output }
  }

  output = (data) => {
    if (!data.isCompress) {
      return {
        width: data.width,
        height: data.height,
        arr: new Uint8ClampedArray(data.data)
      }
    }
    return this.decompress(data)
  }

  getButtonCode (button) {
    if (button === 0) {
      return 1
    } else if (button === 2) {
      return 2
    } else {
      return 0
    }
  }

  getKeyCode (event) {
    const { type, button } = event
    if (type.startsWith('key')) {
      return scanCode(event)
    } else if (type === 'mousemove') {
      return 0
    } else {
      return this.getButtonCode(button)
    }
  }

  handleCanvasEvent = e => {
    // e.preventDefault()
    // console.log('e', e)
    const {
      type,
      clientX,
      clientY
    } = e
    const {
      left,
      top
    } = e.target.getBoundingClientRect()
    const x = clientX - left
    const y = clientY - top
    // console.log('x,y', x, y, left, top, clientX, clientY, pageX, pageY)
    const keyCode = this.getKeyCode(e)
    const action = type.startsWith('key')
      ? 'sendKeyEventScancode'
      : type === 'mousewheel'
        ? 'sendWheelEvent'
        : 'sendPointerEvent'
    const pressed = type === 'mousedown' || type === 'keydown'
    let params = []
    if (type.startsWith('mouse') || type.startsWith('context')) {
      params = [x, y, keyCode, pressed]
    } else if (type === 'wheel') {
      const isHorizontal = false
      const delta = isHorizontal ? e.deltaX : e.deltaY
      const step = Math.round(Math.abs(delta) * 15 / 8)
      // console.log(x, y, step, delta, isHorizontal)
      params = [x, y, step, delta > 0, isHorizontal]
    } else if (type === 'keydown' || type === 'keyup') {
      params = [keyCode, pressed]
    }
    this.socket.send(JSON.stringify({
      action,
      params
    }))
  }

  onData = async (msg) => {
    // console.log('msg', msg.data)
    let { data } = msg
    data = JSON.parse(data)
    if (data.action === 'session-rdp-connected') {
      return this.setState({
        loading: false
      })
    }
    const id = 'canvas_' + this.props.tab.id
    const canvas = document.getElementById(id)
    const ctx = canvas.getContext('2d')
    const {
      width,
      height,
      arr
    } = this.output(data)
    const imageData = ctx.createImageData(width, height)
    imageData.data.set(arr)
    ctx.putImageData(imageData, data.destLeft, data.destTop)
  }

  onerrorSocket = err => {
    this.setStatus(statusMap.error)
    log.error('socket error', err)
  }

  closeMsg = () => {
    notification.destroy(this.warningKey)
  }

  handleClickClose = () => {
    this.closeMsg()
    this.handleReInit()
  }

  handleReInit = () => {
    this.socket.send(JSON.stringify({
      action: 'reload',
      params: [
        this.state.width,
        this.state.height
      ]
    }))
    this.setState({
      loading: true
    })
  }

  handleReload = () => {
    this.closeMsg()
    this.props.reloadTab(
      this.props.tab
    )
  }

  handleEditResolutions = () => {
    window.store.toggleResolutionEdit()
  }

  oncloseSocket = () => {
    // this.setStatus(
    //   statusMap.error
    // )
    // this.warningKey = `open${Date.now()}`
    // notification.warning({
    //   key: this.warningKey,
    //   message: e('socketCloseTip'),
    //   duration: 30,
    //   description: (
    //     <div className='pd2y'>
    //       <Button
    //         className='mg1r'
    //         type='primary'
    //         onClick={this.handleClickClose}
    //       >
    //         {m('close')}
    //       </Button>
    //       <Button
    //         icon={<ReloadOutlined />}
    //         onClick={this.handleReload}
    //       >
    //         {m('reload')}
    //       </Button>
    //     </div>
    //   )
    // })
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
    return (
      <HelpIcon
        link={rdpHelpLink}
      />
    )
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
      onMouseDown: this.handleCanvasEvent,
      onMouseUp: this.handleCanvasEvent,
      onMouseMove: this.handleCanvasEvent,
      onKeyDown: this.handleCanvasEvent,
      onKeyUp: this.handleCanvasEvent,
      onWheel: this.handleCanvasEvent,
      onContextMenu: this.handleCanvasEvent,
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
            id={'canvas_' + this.props.tab.id}
          />
        </div>
      </Spin>
    )
  }
}

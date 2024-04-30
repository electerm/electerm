import { Component } from '../common/react-subx'
import { createTerm } from '../terminal/terminal-apis'
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
import { RleDecoder } from 'dicom-rle'
import './rle.js'

const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')

export default class RdpSession extends Component {
  state = {
    loading: false,
    bitmapProps: {}
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

  computeProps = () => {
    const {
      height,
      width,
      tabsHeight,
      leftSidebarWidth,
      pinned,
      openedSideBar
    } = this.props
    return {
      width: width - (pinned && openedSideBar ? leftSidebarWidth : 0),
      height: height - tabsHeight
    }
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
    console.log('opts', opts)
    let pid = await createTerm(opts)
      .catch(err => {
        const text = err.message
        handleErr({ message: text })
      })
    pid = pid || ''
    console.log('pid', pid)
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
    const { width, height } = this.computeProps()
    const wsUrl = `${pre}://${hs}/rdp/${pid}?sessionId=${sessionId}&token=${tokenElecterm}&width=${width}&height=${height}`
    const socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    this.socket = socket
    socket.onopen = () => {
      this.runInitScript()
    }
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
        throw 'invalid bitmap data format'
    }

    const input = new Uint8Array(bitmap.data)
    const inputPtr = Module._malloc(input.length)
    const inputHeap = new Uint8Array(Module.HEAPU8.buffer, inputPtr, input.length)
    inputHeap.set(input)

    const output_width = bitmap.destRight - bitmap.destLeft + 1
    const output_height = bitmap.destBottom - bitmap.destTop + 1
    const ouputSize = output_width * output_height * 4
    const outputPtr = Module._malloc(ouputSize)

    const outputHeap = new Uint8Array(Module.HEAPU8.buffer, outputPtr, ouputSize)

    const res = Module.ccall(fName,
      'number',
      ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [outputHeap.byteOffset, output_width, output_height, bitmap.width, bitmap.height, inputHeap.byteOffset, input.length]
    )

    const output = new Uint8ClampedArray(outputHeap.buffer, outputHeap.byteOffset, ouputSize)

    Module._free(inputPtr)
    Module._free(outputPtr)

    return { width: output_width, height: output_height, data: output }
  }

  output = (data) => {
    if (data.isCompress) {
      return {
        width: data.width,
        height: data.height,
        arr: new Uint8ClampedArray(data.data)
      }
    }
    const w = data.destRight - data.destLeft + 1
    const h = data.destBottom - data.destTop + 1
    return this.decompress(data)
  }

  onData = async (msg) => {
    console.log('msg', msg.data)
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
    this.props.delSplit(this.state.id)
  }

  handleReload = () => {
    this.closeMsg()
    this.props.reloadTab(
      this.props.tab
    )
  }

  oncloseSocket = () => {
    this.setStatus(
      statusMap.error
    )
    this.warningKey = `open${Date.now()}`
    notification.warning({
      key: this.warningKey,
      message: e('socketCloseTip'),
      duration: 30,
      description: (
        <div className='pd2y'>
          <Button
            className='mg1r'
            type='primary'
            onClick={this.handleClickClose}
          >
            {m('close')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={this.handleReload}
          >
            {m('reload')}
          </Button>
        </div>
      )
    })
  }

  render () {
    const { width, height } = this.computeProps()
    const rdpProps = {
      style: {
        width: width + 'px',
        height: height + 'px'
      }
    }
    const canvasProps = {
      width,
      height
    }
    return (
      <div
        {...rdpProps}
        className='rdp-session-wrap'
      >
        <Spin spinning={this.state.loading}>
          <canvas {...canvasProps} id={'canvas_' + this.props.tab.id} />
        </Spin>
      </div>
    )
  }
}

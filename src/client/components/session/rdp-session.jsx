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
import * as utils from './bitmap-utils'

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

  decompressBitmap = (uint8Arr, width, height, bitsPerPixel) => {
    // Calculate the number of bytes per pixel
    const bytesPerPixel = bitsPerPixel / 8

    // Calculate the total size of the image data
    const dataSize = width * height * bytesPerPixel

    // Allocate memory for the decompressed pixel data
    const decompressedData = new Uint8Array(dataSize)

    // Perform decompression
    let decompressedIndex = 0

    // Assuming no compression for simplicity, directly copy data
    for (let i = 0; i < uint8Arr.length; i += bytesPerPixel) {
      decompressedData[decompressedIndex++] = uint8Arr[i] // Assuming data is in RGBA order
      decompressedData[decompressedIndex++] = uint8Arr[i + 1]
      decompressedData[decompressedIndex++] = uint8Arr[i + 2]
      decompressedData[decompressedIndex++] = uint8Arr[i + 3] // Assuming 32 bits per pixel (RGBA)
    }
    return decompressedData
  }

  decompress4 = (data, w, h, conf) => {
    /*
    bitmap_decompress_32(uint8 * output, int output_width, int output_height, int input_width, int input_height, uint8* input, int size) {
      uint8 * temp = (uint8*)malloc(input_width * input_height * 4);
      RD_BOOL rv = bitmap_decompress4(temp, input_width, input_height, input, size);
      // convert to rgba
      for (int y = 0; y < output_height; y++) {
        for (int x = 0; x < output_width; x++) {
          uint8 r = temp[(y * input_width + x) * 4];
          uint8 g = temp[(y * input_width + x) * 4 + 1];
          uint8 b = temp[(y * input_width + x) * 4 + 2];
          uint8 a = temp[(y * input_width + x) * 4 + 3];
          ((uint32*)output)[y * output_width + x] = 0xff << 24 | r << 16 | g << 8 | b;
        }
      }
      free(temp);
      return rv;
    }
    */
    const {
      width,
      confbitsPerPixel
    } = conf
    const bytesPerPixel = confbitsPerPixel / 8
    const dataSize = w * h * bytesPerPixel
    const decompressedData = new Uint8Array(dataSize)
    // convert to rgba
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const r = data[(y * width + x) * 4]
        const g = data[(y * width + x) * 4 + 1]
        const b = data[(y * width + x) * 4 + 2]
        // const a = temp[(y * inputWidth + x) * 4 + 3]
        decompressedData[y * w + x] = 0xff << 24 | r << 16 | g << 8 | b
      }
    }
    return decompressedData
  }

  output = (data) => {
    if (data.isCompress) {
      return {
        width: data.width,
        height: data.height,
        arr: new Uint8ClampedArray(data.data)
      }
    }
    // return this.decompress2(data)
    const w = data.destRight - data.destLeft + 1
    const h = data.destBottom - data.destTop + 1
    return {
      width: w,
      height: h,
      arr: new Uint8ClampedArray(this.decompressBitmap(data.data, w, h, data.bitsPerPixel))
    }
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

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
  Button,
  Select
} from 'antd'
import {
  ReloadOutlined
} from '@ant-design/icons'
import * as ls from '../../common/safe-local-storage'

const { Option } = Select
const { prefix } = window
const e = prefix('ssh')
const m = prefix('menu')

export default class RdpSession extends Component {
  static resolutions = [
    {
      width: 1024,
      height: 768
    },
    {
      width: 1280,
      height: 720
    },
    {
      width: 1280,
      height: 800
    },
    {
      width: 1280,
      height: 1024
    },
    {
      width: 1366,
      height: 768
    },
    {
      width: 1440,
      height: 900
    },
    {
      width: 1600,
      height: 900
    },
    {
      width: 1600,
      height: 1200
    },
    {
      width: 1920,
      height: 1080
    },
    {
      width: 1920,
      height: 1200
    },
    {
      width: 1920,
      height: 1440
    },
    {
      width: 2560,
      height: 1440
    },
    {
      width: 2560,
      height: 1600
    },
    {
      width: 2560,
      height: 1920
    },
    {
      width: 3840,
      height: 2160
    },
    {
      width: 3840,
      height: 2400
    },
    {
      width: 5120,
      height: 2880
    },
    {
      width: 7680,
      height: 4320
    }
  ]

  constructor (props) {
    const id = `rdp-res-${props.tab.host}`
    const resObj = ls.getItemJSON(id, {
      width: 1024,
      height: 768
    })
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

  handleResChange = (value) => {
    const [width, height] = value.split('x').map(d => parseInt(d, 10))
    const id = `rdp-res-${this.props.tab.host}`
    ls.setItemJSON(id, {
      width,
      height
    })
    this.setState({
      width,
      height
    })
  }

  renderControl = () => {
    const {
      width,
      height
    } = this.state
    const sleProps = {
      value: `${width}x${height}`,
      onChange: this.handleResChange,
      popupMatchSelectWidth: false
    }
    return (
      <div className='pd1'>
        <Select
          {...sleProps}
        >
          {
            RdpSession.resolutions.map(d => {
              const v = `${d.width}x${d.height}`
              return (
                <Option
                  key={v}
                  value={v}
                >
                  {v}
                </Option>
              )
            })
          }
        </Select>
      </div>
    )
  }

  render () {
    const { width: w, height: h } = this.computeProps()
    const rdpProps = {
      style: {
        width: w + 'px',
        height: h + 'px'
      }
    }
    const { width, height, loading } = this.state
    const canvasProps = {
      width,
      height
    }
    return (
      <Spin spinning={loading}>
        <div
          {...rdpProps}
          className='rdp-session-wrap'
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

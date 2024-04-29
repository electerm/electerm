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
import { decode } from "@thi.ng/rle-pack";

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

  decompress = (arr) => {
    const decompressedArray = []
    let i = 0

    while (i < arr.length) {
      const value = arr[i]
      const count = arr[i + 1]

      // Repeat the value 'count' times
      for (let j = 0; j < count; j++) {
        decompressedArray.push(value)
      }

      i += 2 // Move to the next RLE pair
    }

    return decompressedArray
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
    const {
      destTop,
      destLeft,
      destBottom,
      destRight,
      width,
      height,
      bitsPerPixel,
      isCompress,
      data: bitmap // number[] converted from JSON.stringify(Buffer)
    } = data
    const id = 'canvas_' + this.props.tab.id
    const canvas = document.getElementById(id)
    const ctx = canvas.getContext('2d')
    console.log(ctx)
    const imageData = ctx.createImageData(width, height)
    const dataView = new DataView(imageData.data.buffer)

    // Fill the ImageData with pixel values (grayscale)
    const uarr = new Uint8Array(bitmap.data.length)
    uarr.set(bitmap.data)
    const arr = decode(uarr)
    console.log('arr length', arr.length, dataView.length)
    for (let i = 0; i < dataView.byteLength; i++) {
      const pixelValue = arr[i] // Assuming bitmap is your array of numbers
      dataView.setUint8(i, pixelValue)
    }
    ctx.putImageData(imageData, destLeft, destTop)
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

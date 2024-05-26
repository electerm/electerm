import RdpSession from '../rdp/rdp-session'
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
  message,
  Select,
  Modal
} from 'antd'
import {
  ReloadOutlined,
  EditOutlined
} from '@ant-design/icons'
import * as ls from '../../common/safe-local-storage'
import { copy } from '../../common/clipboard'
import resolutions from '../rdp/resolutions'
import RFB from '@novnc/novnc/core/rfb'
import VncForm from './vnc-form'

const { Option } = Select
const { prefix } = window
const e = prefix('form')

export default class VncSession extends RdpSession {
  constructor (props) {
    const id = `vnc-reso-${props.tab.host}`
    const resObj = ls.getItemJSON(id, resolutions[0])
    super(props)
    this.state = {
      types: [],
      showConfirm: false,
      loading: false,
      aspectRatio: 4 / 3,
      name: '',
      ...resObj
    }
  }

  componentDidMount () {
    this.remoteInit()
  }

  componentWillUnmount () {
    this.rfb && this.rfb.disconnect()
    delete this.rfb
  }

  runInitScript = () => {

  }

  setStatus = status => {
    const id = this.props.tab?.id
    this.props.editTab(id, {
      status
    })
  }

  // computeProps = () => {
  //   const {
  //     height,
  //     width,
  //     tabsHeight,
  //     leftSidebarWidth,
  //     pinned,
  //     openedSideBar
  //   } = this.props
  //   return {
  //     width: width - (pinned && openedSideBar ? leftSidebarWidth : 0),
  //     height: height - tabsHeight
  //   }
  // }

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
      term: terminalType,
      viewOnly = false,
      scaleViewport = true,
      username,
      password
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
    const wsUrl = `${pre}://${hs}/vnc/${pid}?sessionId=${sessionId}&token=${tokenElecterm}&width=${width}&height=${height}`
    const vncOpts = {
      scaleViewport,
      viewOnly,
      style: {
        width: width + 'px',
        height: height + 'px',
        overflow: 'scroll'
      },
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
    const events = [
      'connect',
      'disconnect',
      'credentialsrequired',
      'securityfailure',
      'clipboard',
      'bell',
      'desktopname',
      'capabilities'
    ]
    for (const event of events) {
      rfb.addEventListener(event, this[`on${window.capitalizeFirstLetter(event)}`])
    }
    this.rfb = rfb
  }

  onConnect = (event) => {
    // console.log('onConnect', event)
    this.setStatus(statusMap.success)
    this.setState({
      loading: false
    })
  }

  onDisconnect = () => {
    this.setStatus(statusMap.error)
  }

  onSecurityfailure = (event) => {
    // console.log('onSecurityFailure', event)
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
    // console.log('onClipboard', event)
    copy(event.detail.text)
  }

  onBell = (event) => {
    // console.log('Bell', event)
    message.warning('Bell')
  }

  onDesktopname = (event) => {
    this.setState({
      name: event?.detail?.name || ''
    })
  }

  onCapabilities = (capabilities) => {
    console.log('onCapabilities', capabilities)
  }

  getDom = () => {
    const id = 'canvas_' + this.props.tab.id
    return document.getElementById(id)
  }

  closeMsg = () => {
    notification.destroy(this.warningKey)
  }

  handleClickClose = () => {
    this.closeMsg()
    this.handleReInit()
  }

  handleReInit = () => {
    this.rfb?.disconnect()
    delete this.rfb
    this.remoteInit()
  }

  handleEditResolutions = () => {
    window.store.toggleResolutionEdit()
  }

  oncloseSocket = () => {
  }

  getAllRes = () => {
    return [
      ...this.props.resolutions,
      ...resolutions
    ]
  }

  handleResChange = (v) => {
    const res = this.getAllRes().find(d => d.id === v)
    const id = `vnc-reso-${this.props.tab.host}`
    ls.setItemJSON(id, res)
    this.setState(res)
  }

  renderControl = () => {
    const {
      id,
      name
    } = this.state
    const sleProps = {
      value: id,
      onChange: this.handleResChange,
      popupMatchSelectWidth: false
    }
    const {
      host,
      port,
      username
    } = this.props.tab
    return (
      <div className='pd1 fix'>
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
        <span className='mg2l mg2r'>
          <b>{name}</b> {username}@{host}:{port}
        </span>
      </div>
    )
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
      visible: true
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
    const { width: w, height: h } = this.computeProps()
    const vncProps = {
      style: {
        width: w + 'px',
        height: h + 'px'
      }
    }
    const { width, height, loading } = this.state
    const divProps = {
      style: {
        width: width + 'px',
        height: height + 'px'
      }
    }
    return (
      <Spin spinning={loading}>
        <div
          {...vncProps}
          className='rdp-session-wrap pd1'
        >
          {this.renderControl()}
          <div
            {...divProps}
            className='vnc-session-wrap'
            id={'canvas_' + this.props.tab.id}
          />
          {this.renderConfirm()}
        </div>
      </Spin>
    )
  }
}

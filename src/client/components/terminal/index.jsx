
import React from 'react'
import fetch from '../../common/fetch'
import {generate} from 'shortid'
import _ from 'lodash'

const {Terminal, getGlobal} = window
let config = getGlobal('_config')
let passEnd = /password: /
let yesnoEnd = /\(yes\/no\)\? /

export default class Term extends React.Component {

  constructor(props) {
    super()
    this.state = {
      id: props.id || generate()
    }
  }

  componentDidMount() {
    this.initTerminal()
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.height !== this.props.height ||
      prevProps.width !== this.props.width
    ) {
      this.onResize()
    }
  }

  componentWillUnmount() {
    Object.keys(this.timers).forEach(k => {
      clearTimeout(this.timers[k])
    })
    clearTimeout(this.timers)
    this.term.destroy()
  }

  timers = {}

  initTerminal = async () => {
    let {id} = this.state
    let term = new Terminal()
    term.open(document.getElementById(id), true)
    await this.remoteInit(term)
    term.focus()
    term.fit()
    this.term = term
    this.timers.timer1 = setTimeout(this.initData, 10)
  }

  count = 0

  initData = () => {
    let base = this.getBaseText()
    let {tab = {}} = this.props
    this.term._sendData(base)
    if (tab.host) {
      this.term.socket.addEventListener('message', this.handler1)
    }
  }

  getBaseText = () => {
    let base = 'cd ~\rclear\r'
    let {tab = {}} = this.props
    let {host, port, username} = tab
    if (tab.host) {
      base = `${base}\rssh -p ${port} ${username}@${host}\r`
    }
    return base
  }

  getPassText = () => {
    this.count ++
    let {tab = {}} = this.props
    let {password} = tab
    let passTxt = `${password}\r`
    return passTxt
  }

  handler1 = d => {
    this.count ++
    let base = this.getBaseText()
    let len = base.length
    let passTxt = this.getPassText()
    if (yesnoEnd.test(d.data)) {
      this.term._sendData('yes\r')
      this.term.socket.addEventListener('message', this.handler2)
      this.term.socket.removeEventListener('message', this.handler1)
    } else if (passEnd.test(d.data)) {
      this.term._sendData(passTxt)
      this.term.socket.removeEventListener('message', this.handler1)
    } else if (this.count > len * 2) {
      this.term.socket.removeEventListener('message', this.handler1)
    }
  }

  handler2 = d => {
    let passTxt = this.getPassText()
    if (passEnd.test(d.data)) {
      this.term._sendData(passTxt)
      this.term.socket.removeEventListener('message', this.handler2)
    }
  }

  remoteInit = async (term) => {
    let {cols, rows} = term
    let {host, port} = config
    let wsUrl
    let url = `http://${host}:${port}/terminals?cols=${cols}&rows=${rows}`
    let pid = await fetch.post(url)
    if (!pid) return

    term.pid = pid
    this.pid = pid
    wsUrl = `ws://${host}:${port}/terminals/${pid}`
    let socket = new WebSocket(wsUrl)
    socket.onclose = this.oncloseSocket
    socket.onerror = this.onerrorSocket
    socket.onopen = () => {
      term.attach(socket)
      term._initialized = true
    }
    this.socket = socket
    term.on('resize', this.onResizeTerminal)
  }

  onResize = () => {
    let cid = _.get(this.props, 'currentTabId')
    let tid = _.get(this.props, 'tab.id')
    if (cid === tid && this.term) {
      let {cols, rows} = this.term.proposeGeometry()
      this.term.resize(cols, rows)
    }
  }

  onerrorSocket = err => {
    console.log(err.stack)
  }

  oncloseSocket = () => {
    console.log('socket closed, pid:', this.pid)
  }

  onResizeTerminal = size => {
    let {cols, rows} = size
    let {host, port} = config
    let {pid} = this
    let url = `http://${host}:${port}/terminals/${pid}/size?cols=${cols}&rows=${rows}`
    fetch.post(url)
  }

  render() {
    let {id} = this.state
    let {height} = this.props
    return (
      <div id={id} style={{height}}/>
    )
  }

}

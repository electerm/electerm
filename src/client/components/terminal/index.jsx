
import React from 'react'
import fetch from '../../common/fetch'
import {generate} from 'shortid'

const {Terminal, getGlobal} = window
let config = getGlobal('_config')

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
    term.open(document.getElementById(id))
    await this.remoteInit(term)
    term.focus()
    term.fit()
    this.term = term
    this.timers.timer1 = setTimeout(this.initData, 10)
  }

  initData = () => {
    let base = 'cd ~\rclear\r'
    let {tab} = this.props
    let {host, port, username, password} = tab
    if (tab.host) {
      base = `${base}\rssh -p ${port} ${username}@${host}\r`
    }
    let len = base.length
    let count = 0
    this.term._sendData(base)
    let passEnd = /password: /
    let yesnoEnd = /\(yes\/no\)\? /
    if (tab.host) {
      let passTxt = `${password}\r`
      let handler2 = d => {
        if (passEnd.test(d.data)) {
          this.term._sendData(passTxt)
          this.term.socket.removeEventListener('message', handler2)
        }
      }
      let handler1 = d => {
        count ++
        if (yesnoEnd.test(d.data)) {
          this.term._sendData('yes\r')
          this.term.socket.addEventListener('message', handler2)
          this.term.socket.removeEventListener('message', handler1)
        } else if (passEnd.test(d.data)) {
          this.term._sendData(passTxt)
          this.term.socket.removeEventListener('message', handler1)
        } else if (count > len * 2) {
          this.term.socket.removeEventListener('message', handler1)
        }
      }
      this.term.socket.addEventListener('message', handler1)
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

  onerrorSocket = err => {
    console.log(err.stack)
  }

  oncloseSocket = () => {
    //todo
  }

  onResizeTerminal = size => {
    let {cols, rows} = size
    let {host, port} = config
    let url = `http://${host}:${port}/terminals?cols=${cols}&rows=${rows}`
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

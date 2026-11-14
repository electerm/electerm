/**
 * Serial tab controls in the session toolbar: DTR / RTS / break, CTS / DSR /
 * DCD leds, the view of received data (ascii / hex / dec / bin, frame bytes,
 * byte cursor) and raw byte send. Talks to TerminalSerial.serialEvent
 * (app/server/session-serial.js) over the tab's terminal socket.
 *
 * Desktop keeps the icons inline in the toolbar. The toolbar has no room for
 * a row of controls on a phone, so mobile gets a single icon that opens one
 * panel with all of it (see session-control.jsx, compact).
 */

import { useEffect, useRef, useState } from 'react'
import {
  Button, Checkbox, Divider, Input, Modal, Popover, Radio, Select, Space, Tooltip
} from 'antd'
import {
  EyeOutlined, SendOutlined, SlidersOutlined, ThunderboltOutlined, WarningOutlined
} from '@ant-design/icons'
import classnames from 'classnames'
import { parseSerialInput } from '../../common/serial-input'
import { refs } from '../common/ref'

const formats = ['ascii', 'hex', 'dec', 'bin'].map(v => ({
  value: v,
  label: v.toUpperCase()
}))

const placeholders = {
  hex: '1B 41 0D',
  dec: '27 65 13',
  bin: '00011011 01000001',
  ascii: 'text, \\r \\n \\xHH'
}

const lineNames = {
  dtr: 'DTR (data terminal ready)',
  rts: 'RTS (request to send)',
  cts: 'CTS (clear to send)',
  dsr: 'DSR (data set ready)',
  dcd: 'DCD (carrier detect)'
}

// modem status lines have no change event: polled while the tab is shown
const POLL = 300
// the break pulse is on the server; this is only the toolbar flash
const BREAK_FLASH = 300

const hexByte = b => typeof b === 'number'
  ? b.toString(16).toUpperCase().padStart(2, '0')
  : ''

const printable = b => b >= 0x20 && b < 0x7f
  ? `'${String.fromCharCode(b)}'`
  : '.'

/**
 * a frame byte as typed: '' -> null, '10' / '0x10' -> 16
 */
function parseFrameByte (text) {
  if (!text.trim()) {
    return null
  }
  const bytes = parseSerialInput(text, 'hex')
  if (bytes.length !== 1) {
    throw new Error('one byte, e.g. 10 or 0xFF')
  }
  return bytes[0]
}

// frame start / stop byte of the rx view: switch and value; the value
// stays when switched off
function FrameByte ({ label, value, onChange }) {
  const on = typeof value === 'number'
  const [text, setText] = useState(hexByte(value))
  const [error, setError] = useState('')
  useEffect(() => {
    if (typeof value === 'number') {
      setText(hexByte(value))
    }
  }, [value])
  // the byte typed, or undefined (error shown)
  function parse (t) {
    try {
      const b = parseFrameByte(t)
      setError(b === null && on ? 'enter a byte, e.g. 10' : '')
      return b
    } catch (e) {
      setError(e.message)
    }
  }
  function apply () {
    const b = parse(text)
    if (on && typeof b === 'number' && b !== value) {
      onChange(b)
    }
  }
  function onSwitch (ev) {
    if (!ev.target.checked) {
      setError('')
      return onChange(null)
    }
    const b = parse(text)
    if (typeof b === 'number') {
      onChange(b)
    } else if (b === null) {
      setError('enter a byte first, e.g. 10')
    }
  }
  return (
    <div className='pd1t'>
      <Space size='small' align='center'>
        <Checkbox checked={on} onChange={onSwitch}>
          {label}
        </Checkbox>
        <Input
          size='small'
          value={text}
          status={error ? 'error' : ''}
          placeholder='10'
          style={{ width: 72 }}
          onChange={ev => setText(ev.target.value)}
          onPressEnter={apply}
          onBlur={apply}
        />
      </Space>
      {error ? <div className='color-red font12'>{error}</div> : null}
    </div>
  )
}

// what the tab last sent, so a poll that changes nothing does not rerender
function sameState (a, b) {
  const keys = ['dtr', 'rts', 'brk', 'cts', 'dsr', 'dcd', 'mode', 'ascii',
    'start', 'stop', 'error']
  for (const k of keys) {
    if (a[k] !== b[k]) {
      return false
    }
  }
  const x = a.cursor
  const y = b.cursor
  return x === y || (!!x && !!y && x.offset === y.offset && x.byte === y.byte)
}

export default function SerialControl ({ tabId, compact }) {
  const [st, setSt] = useState({})
  const [inputFormat, setInputFormat] = useState('hex')
  const [text, setText] = useState('')
  const [inputError, setInputError] = useState('')
  // compact mode: the panel is a modal, the toolbar only holds the trigger
  const [open, setOpen] = useState(false)
  // break flash only, see BREAK_FLASH
  const [brk, setBrk] = useState(false)
  const bound = useRef(null)
  const brkTimer = useRef(null)

  const getSocket = () => refs.get('term-' + tabId)?.socket

  function send (msg) {
    const s = getSocket()
    if (s?.readyState === 1) {
      // the socket's own send also broadcasts typed input to other tabs
      window.WebSocket.prototype.send.call(
        s, JSON.stringify({ action: 'serial-event', ...msg })
      )
    }
  }

  useEffect(() => {
    const onMsg = ev => {
      if (typeof ev.data !== 'string') {
        return
      }
      try {
        const msg = JSON.parse(ev.data)
        if (msg.action === 'serial-event') {
          setSt(prev => sameState(prev, msg) ? prev : msg)
        }
      } catch (e) {}
    }
    const tick = () => {
      // the socket is replaced on reconnect
      const s = getSocket()
      if (s !== bound.current) {
        bound.current?.removeEventListener('message', onMsg)
        s?.addEventListener('message', onMsg)
        bound.current = s
      }
      if (window.store?.activeTabId === tabId) {
        send({ cmd: 'get' })
      }
    }
    // back from a hidden window: the leds are stale, ask right away
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }
    tick()
    const timer = setInterval(tick, POLL)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      bound.current?.removeEventListener('message', onMsg)
      bound.current = null
    }
  }, [tabId])

  useEffect(() => () => clearTimeout(brkTimer.current), [])

  function onSend () {
    try {
      const data = parseSerialInput(text, inputFormat)
      setInputError('')
      send({ cmd: 'send', data })
    } catch (e) {
      setInputError(e.message)
    }
  }

  function onBreak () {
    send({ cmd: 'set', brk: true })
    setBrk(true)
    clearTimeout(brkTimer.current)
    brkTimer.current = setTimeout(() => setBrk(false), BREAK_FLASH)
  }

  const mode = st.mode || 'ascii'
  const framed = typeof st.start === 'number' || typeof st.stop === 'number'
  const cur = st.cursor
  const onOff = name => `${lineNames[name]}: ${st[name] ? 'asserted' : 'idle'}`
  const cursorText = cur
    ? `#${cur.offset} 0x${hexByte(cur.byte)} ${cur.byte} ${cur.byte.toString(2).padStart(8, '0')} ${printable(cur.byte)}`
    : ''

  // asserted line: green, like a led. Idle stays in the normal text color,
  // color-green is a color utility, see css/includes/text.styl
  const litIf = (on, cls) => classnames(cls, { 'color-green': on })

  const lineSwitch = name => send({ cmd: 'set', [name]: !st[name] })

  const viewBody = (
    <div>
      <div className='font12 pd1b'>Received data as</div>
      <Radio.Group
        size='small'
        optionType='button'
        value={mode}
        options={formats}
        onChange={ev => send({ cmd: 'view', mode: ev.target.value })}
      />
      <div className='pd1t'>
        <Checkbox
          checked={st.ascii !== false}
          disabled={mode === 'ascii'}
          onChange={ev => send({ cmd: 'view', ascii: ev.target.checked })}
        >
          ASCII column
        </Checkbox>
      </div>
      <FrameByte
        label='Frame start'
        value={st.start}
        onChange={start => send({ cmd: 'view', start })}
      />
      <FrameByte
        label='Frame stop'
        value={st.stop}
        onChange={stop => send({ cmd: 'view', stop })}
      />
      <div className='font12 pd1t'>
        Frame bytes start a new line and redraw what was received. In HEX /
        DEC / BIN the arrow keys move the byte cursor, they are not sent.
      </div>
    </div>
  )

  const sendBody = autoFocus => (
    <div>
      <Space.Compact block>
        <Select
          size='small'
          value={inputFormat}
          options={formats}
          onChange={setInputFormat}
          popupMatchSelectWidth={false}
          style={{ width: 78 }}
        />
        <Input
          size='small'
          autoFocus={autoFocus}
          value={text}
          status={inputError ? 'error' : ''}
          placeholder={placeholders[inputFormat]}
          onChange={ev => setText(ev.target.value)}
          onPressEnter={onSend}
        />
        <Button size='small' onClick={onSend}>Send</Button>
      </Space.Compact>
      {inputError ? <div className='color-red font12 pd1t'>{inputError}</div> : null}
    </div>
  )

  // CTS / DSR / DCD: set by the device, shown only
  const led = (name, withLabel, cls) => (
    <Tooltip key={name} title={onOff(name)}>
      <span className={litIf(st[name], classnames(cls, 'font12'))}>
        ●{withLabel ? ` ${name.toUpperCase()}` : ''}
      </span>
    </Tooltip>
  )

  // ---- mobile: one panel, the toolbar has no room for the row ----

  if (compact) {
    const lineButton = (name, label) => (
      <Button
        key={name}
        size='small'
        type={st[name] ? 'primary' : 'default'}
        onClick={() => lineSwitch(name)}
      >
        {label}
      </Button>
    )
    return (
      <>
        <Tooltip title='Serial: DTR / RTS / break, view of received data, send bytes'>
          <SlidersOutlined
            className={litIf(mode !== 'ascii' || framed || brk, 'sess-icon pointer')}
            onClick={() => setOpen(true)}
          />
        </Tooltip>
        <Modal
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          title='Serial'
          width={320}
          destroyOnHidden
        >
          <Space direction='vertical' size='small' style={{ width: '100%' }}>
            <Space size='small' wrap>
              {lineButton('dtr', 'DTR')}
              {lineButton('rts', 'RTS')}
              <Button size='small' icon={<ThunderboltOutlined />} onClick={onBreak}>
                Break
              </Button>
            </Space>
            <div className='font12'>
              {['cts', 'dsr', 'dcd'].map(n => led(n, true, 'mg2r'))}
            </div>
            <Divider style={{ margin: '4px 0' }} />
            {viewBody}
            <Divider style={{ margin: '4px 0' }} />
            {sendBody(false)}
            {cur
              ? (
                <div className='font12'>
                  Byte at the cursor: {cursorText}
                </div>
                )
              : null}
            {st.error ? <div className='color-red font12'>{st.error}</div> : null}
          </Space>
        </Modal>
      </>
    )
  }

  // ---- desktop: the row in the toolbar ----

  const lineChip = (name, label) => (
    <Tooltip key={name} title={`${onOff(name)}, click to switch`}>
      <span
        className={litIf(st[name], 'sess-icon pointer font12')}
        onClick={() => lineSwitch(name)}
      >
        {label}
      </span>
    </Tooltip>
  )

  return (
    <>
      {lineChip('dtr', 'DTR')}
      {lineChip('rts', 'RTS')}
      <Tooltip title='Break: hold the line low for a moment'>
        <ThunderboltOutlined
          className={litIf(brk, 'sess-icon pointer')}
          onClick={onBreak}
        />
      </Tooltip>
      {['cts', 'dsr', 'dcd'].map(n => led(n, false, 'sess-icon'))}
      {st.error
        ? (
          <Tooltip title={st.error}>
            <WarningOutlined className='sess-icon color-red' />
          </Tooltip>
          )
        : null}
      <Popover content={viewBody} trigger='click' placement='bottom'>
        <Tooltip title='Received data as ASCII / HEX / DEC / BIN, frame bytes'>
          <span className={classnames('sess-icon pointer', { active: mode !== 'ascii' || framed })}>
            <EyeOutlined /> {mode.toUpperCase()}
          </span>
        </Tooltip>
      </Popover>
      {cur
        ? (
          <Tooltip title={`Byte at the cursor, ${cursorText}`}>
            <code className='sess-icon font12'>
              0x{hexByte(cur.byte)} {printable(cur.byte)}
            </code>
          </Tooltip>
          )
        : null}
      <Popover content={sendBody(true)} trigger='click' placement='bottom'>
        <Tooltip title='Send bytes: hex, dec, bin, or ascii with \r \n \t \xHH'>
          <span className='sess-icon pointer'>
            <SendOutlined />
          </span>
        </Tooltip>
      </Popover>
    </>
  )
}

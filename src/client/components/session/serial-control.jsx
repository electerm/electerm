/**
 * Serial tab icons in the session toolbar (like hterm): switch DTR / RTS /
 * break, show CTS / DSR / DCD, rx view as ascii / hex / dec / bin (with the
 * byte under the arrow key cursor), send raw bytes. Talks to TerminalSerial.serialEvent (app/server/session-serial.js)
 * over the tab's terminal socket.
 */

import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Input, Popover, Radio, Select, Space, Tooltip } from 'antd'
import { EyeOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons'
import classnames from 'classnames'
import { parseSerialInput } from '../../common/serial-input'
import { refs } from '../common/ref'

const formats = ['ascii', 'hex', 'dec', 'bin'].map(v => ({
  value: v,
  label: v.toUpperCase()
}))

const hexByte = b => typeof b === 'number'
  ? b.toString(16).toUpperCase().padStart(2, '0')
  : ''

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
      <Checkbox checked={on} onChange={onSwitch} className='serial-frame-label'>
        {label}
      </Checkbox>
      <Input
        size='small'
        className='serial-frame-input'
        value={text}
        status={error ? 'error' : ''}
        placeholder='e.g. 10'
        onChange={ev => setText(ev.target.value)}
        onPressEnter={apply}
        onBlur={apply}
      />
      {error ? <div className='color-red'>{error}</div> : null}
    </div>
  )
}

const placeholders = {
  hex: '1B 41 0D',
  dec: '27 65 13',
  bin: '00011011 01000001',
  ascii: 'text, \\r \\n \\xHH'
}

const lineNames = {
  dtr: 'DTR (data terminal ready)',
  rts: 'RTS (request to send)',
  brk: 'Break',
  cts: 'CTS (clear to send)',
  dsr: 'DSR (data set ready)',
  dcd: 'DCD (carrier detect)'
}

// modem status lines have no change event: polled while the tab is shown
const POLL = 300

export default function SerialControl ({ tabId }) {
  const [st, setSt] = useState({})
  const [inFormat, setInFormat] = useState('hex')
  const [text, setText] = useState('')
  const [inputError, setInputError] = useState('')
  const bound = useRef(null)

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
          setSt(msg)
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
    tick()
    const timer = setInterval(tick, POLL)
    return () => {
      clearInterval(timer)
      bound.current?.removeEventListener('message', onMsg)
      bound.current = null
    }
  }, [tabId])

  function onSend () {
    try {
      const data = parseSerialInput(text, inFormat)
      setInputError('')
      send({ cmd: 'send', data })
    } catch (e) {
      setInputError(e.message)
    }
  }

  const onOff = name => `${lineNames[name]}: ${st[name] ? 'on' : 'off'}`

  // DTR / RTS / break: click to switch
  const output = (name, label) => (
    <Tooltip title={onOff(name) + ', click to switch'} key={name}>
      <span
        className={classnames('sess-icon pointer serial-line', { active: st[name] })}
        onClick={() => send({ cmd: 'set', [name]: !st[name] })}
      >
        {label}
      </span>
    </Tooltip>
  )

  // CTS / DSR / DCD: from the device, shown only
  const led = name => (
    <Tooltip title={onOff(name)} key={name}>
      <span className={classnames('serial-led', { on: st[name] })}>
        <span className='serial-led-dot' />
        {name.toUpperCase()}
      </span>
    </Tooltip>
  )

  const mode = st.mode || 'ascii'
  // the byte the arrow keys marked in hex / dec / bin view
  const cur = st.cursor
  const cursorInfo = cur
    ? (
      <Tooltip title='Byte under the cursor (arrow keys): number since the session started, hex, dec, bin, ascii'>
        <span className='serial-cursor'>
          #{cur.offset} 0x{cur.byte.toString(16).toUpperCase().padStart(2, '0')} {cur.byte} {cur.byte.toString(2).padStart(8, '0')} {cur.byte >= 0x20 && cur.byte < 0x7f ? `'${String.fromCharCode(cur.byte)}'` : ''}
        </span>
      </Tooltip>
      )
    : null
  const viewContent = (
    <div className='serial-popover'>
      <div className='pd1b'>Show received data as</div>
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
        label='Frame start byte (hex)'
        value={st.start}
        onChange={start => send({ cmd: 'view', start })}
      />
      <FrameByte
        label='Frame stop byte (hex)'
        value={st.stop}
        onChange={stop => send({ cmd: 'view', stop })}
      />
      <div className='pd1t serial-hint'>
        When switched on, a new line begins at the frame start byte and after
        the stop byte, unless there is one. Any change redraws all data received so far. In
        HEX / DEC / BIN the arrow keys move a byte cursor instead of being
        sent.
      </div>
    </div>
  )

  const error = inputError || st.error
  const sendContent = (
    <div className='serial-popover'>
      <Space.Compact block>
        <Select
          size='small'
          value={inFormat}
          options={formats}
          onChange={setInFormat}
          popupMatchSelectWidth={false}
        />
        <Input
          size='small'
          autoFocus
          value={text}
          status={inputError ? 'error' : ''}
          placeholder={placeholders[inFormat]}
          onChange={ev => setText(ev.target.value)}
          onPressEnter={onSend}
        />
        <Button size='small' onClick={onSend}>Send</Button>
      </Space.Compact>
      {error ? <div className='color-red pd1t'>{error}</div> : null}
    </div>
  )

  return (
    <span className='serial-control'>
      {output('dtr', 'DTR')}
      {output('rts', 'RTS')}
      <Tooltip title={onOff('brk') + ', click to switch'}>
        <ThunderboltOutlined
          className={classnames('sess-icon pointer serial-line', { active: st.brk })}
          onClick={() => send({ cmd: 'set', brk: !st.brk })}
        />
      </Tooltip>
      <span className='serial-leds'>
        {['cts', 'dsr', 'dcd'].map(led)}
      </span>
      <Popover content={viewContent} trigger='click' placement='bottom'>
        <Tooltip title='View of received data, frame bytes'>
          <span className={classnames('sess-icon pointer serial-line', { active: mode !== 'ascii' || typeof st.start === 'number' || typeof st.stop === 'number' })}>
            <EyeOutlined /> {mode.toUpperCase()}
          </span>
        </Tooltip>
      </Popover>
      {cursorInfo}
      <Popover content={sendContent} trigger='click' placement='bottom'>
        <Tooltip title='Send bytes: type hex, dec, bin or ascii, Enter or Send'>
          <span className={classnames('sess-icon pointer serial-line', { 'color-red': !!st.error })}>
            <SendOutlined /> Send
          </span>
        </Tooltip>
      </Popover>
    </span>
  )
}

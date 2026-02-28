import { useState, useRef, useEffect } from 'react'
import { Button, AutoComplete } from 'antd'
import { ArrowRightOutlined, ThunderboltOutlined } from '@ant-design/icons'
import message from '../common/message'
import copy from 'json-deep-copy'
import newTerm from '../../common/new-terminal'
import InputAutoFocus from '../common/input-auto-focus'
import HelpIcon from '../common/help-icon'

const e = window.translate
const SUPPORTED_PROTOCOLS = ['ssh', 'telnet', 'vnc', 'rdp', 'spice', 'serial', 'ftp', 'http', 'https']

const PROTOCOL_OPTIONS = SUPPORTED_PROTOCOLS.map(p => ({ value: p + '://' }))

/**
 * Parse a quick connect string into connection options
 * @param {string} str - The connection string
 * @returns {object|null} - Parsed options or null if invalid
 */
function parseQuickConnectString (str) {
  if (!str || typeof str !== 'string') {
    return null
  }

  const trimmed = str.trim()
  if (!trimmed) {
    return null
  }

  try {
    const protocolMatch = trimmed.match(/^(ssh|telnet|vnc|rdp|spice|serial|ftp|https?):\/\//i)

    let protocol = ''
    let remaining = trimmed

    if (protocolMatch) {
      protocol = protocolMatch[1].toLowerCase()
      remaining = trimmed.slice(protocolMatch[0].length)
    } else {
      // Default to SSH if it looks like user@host
      if (/^[\w.-]+@[\w.-]+/.test(trimmed)) {
        protocol = 'ssh'
      } else if (/^[\w.-]+:[\d]+/.test(trimmed)) {
        protocol = 'ssh'
      } else {
        message.warning(e('quickConnectInvalidFormat'))
        return null
      }
    }

    if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
      message.warning(`${e('unsupportedProtocol')}: ${protocol}`)
      return null
    }

    let username = ''
    let password = ''
    let hostOrPath = ''
    let port = ''
    let optsStr = ''
    let queryStr = ''

    // Parse query string (standard URL query params)
    const queryMatch = remaining.match(/\?(.+)$/)
    if (queryMatch) {
      queryStr = queryMatch[1]
      remaining = remaining.slice(0, queryMatch.index)
    }

    // Parse opts (JSON string in opts= param)
    const optsMatch = remaining.match(/\?opts='(.+?)'$/)
    if (optsMatch) {
      optsStr = optsMatch[1]
      remaining = remaining.slice(0, optsMatch.index)
    }

    const authMatch = remaining.match(/^(?:(.+?):(.+?)@)?(.+?)(?::(\d+))?$/)
    if (authMatch) {
      username = authMatch[1] || ''
      password = authMatch[2] || ''
      hostOrPath = authMatch[3] || ''
      port = authMatch[4] || ''
    }

    if (!hostOrPath) {
      message.warning(e('quickConnectInvalidFormat'))
      return null
    }

    const opts = {
      tp: protocol,
      host: hostOrPath,
      username,
      password
    }

    // Convert http/https to web type
    if (protocol === 'http' || protocol === 'https') {
      opts.tp = 'web'
      opts.url = `${protocol}://${hostOrPath}${port ? ':' + port : ''}`
      delete opts.host
      delete opts.port
    } else if (protocol === 'web') {
      // For web type, use url instead of host
      opts.url = `${hostOrPath}${port ? ':' + port : ''}`
      delete opts.host
      delete opts.port
    } else if (port) {
      opts.port = parseInt(port, 10)
    }

    // Parse query string (standard URL query params) and add to url for web type
    if (queryStr && (protocol === 'web' || protocol === 'http' || protocol === 'https')) {
      const url = opts.url || `${hostOrPath}${port ? ':' + port : ''}`
      const separator = url.includes('?') ? '&' : '?'
      opts.url = `${url}${separator}${queryStr}`
    }

    // Parse opts JSON to extend params
    if (optsStr) {
      try {
        const extraOpts = JSON.parse(optsStr)
        Object.assign(opts, extraOpts)
      } catch (err) {
        console.error('Failed to parse opts:', err)
      }
    }

    return opts
  } catch (error) {
    console.error('Error parsing quick connect string:', error)
    message.warning(e('quickConnectInvalidFormat'))
    return null
  }
}

/**
 * Connect using parsed options
 * @param {object} opts - Connection options
 * @param {number} batch - Batch number
 */
function connectWithOptions (opts, batch) {
  const { store } = window
  const tabOptions = {
    ...copy(opts),
    ...newTerm(true, true),
    from: 'quickConnect',
    batch: window.openTabBatch ?? store.currentLayoutBatch
  }

  delete window.openTabBatch
  store.addTab(tabOptions)
}

export default function QuickConnect ({ batch }) {
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showInput])

  const handleToggle = () => {
    setShowInput(!showInput)
    if (showInput) {
      setInputValue('')
    }
  }

  const handleConnect = () => {
    if (!inputValue.trim()) {
      return
    }

    const opts = parseQuickConnectString(inputValue)

    if (!opts) {
      return
    }

    connectWithOptions(opts, batch)
    setInputValue('')
    setShowInput(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleConnect()
    }
  }
  function renderInput () {
    if (!showInput) {
      return null
    }
    const autoProps = {
      value: inputValue,
      onChange: setInputValue,
      onEnter: handleKeyPress,
      className: 'quick-connect-input width-100',
      options: PROTOCOL_OPTIONS,
      size: 'large'
    }
    const suffix = inputValue
      ? (
        <ArrowRightOutlined
          className='pointer'
          onClick={handleConnect}
          title={e('connect')}
        />
        )
      : null
    const inputProps = {
      ref: inputRef,
      className: 'width-100',
      suffix,
      size: 'large',
      placeholder: 'ssh|rdp|vnc|spice|serial|http|https://[username]:[password]@host:port?opts={...}'
    }
    return (
      <div className='pd1y pd2x'>
        <AutoComplete {...autoProps}>
          <InputAutoFocus {...inputProps} />
        </AutoComplete>
      </div>
    )
  }
  const wiki = 'https://github.com/electerm/electerm/wiki/quick-connect'

  const btnProps = {
    onClick: handleToggle,
    size: 'large',
    icon: <ThunderboltOutlined />,
    title: e('quickConnect')
  }
  return (
    <>
      <Button
        {...btnProps}
      >
        <span className='mg1r'>{e('quickConnect')}</span>
        <HelpIcon link={wiki} />
      </Button>
      {renderInput()}
    </>
  )
}

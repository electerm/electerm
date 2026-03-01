import { useState, useRef, useEffect } from 'react'
import { Button, Space } from 'antd'
import { ArrowRightOutlined, ThunderboltOutlined } from '@ant-design/icons'
import message from '../common/message'
import InputAutoFocus from '../common/input-auto-focus'
import newTerminal from '../../common/new-terminal'
import HelpIcon from '../common/help-icon'

const e = window.translate

/**
 * Connect using parsed options
 * @param {object} opts - Connection options
 * @param {number} batch - Batch number
 */
function connectWithOptions (opts, batch) {
  const { store } = window
  const tabOptions = {
    ...opts,
    ...newTerminal(),
    from: 'quickConnect',
    batch
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

  function handleChange (e) {
    setInputValue(e.target.value)
  }

  const handleConnect = () => {
    if (!inputValue.trim()) {
      return
    }

    const opts = window.store.parseQuickConnect(inputValue)
    console.log('quick connect opts', opts)
    if (!opts) {
      return message.error('Format error, please check the input', 10)
    }

    connectWithOptions(opts, batch)
    setInputValue('')
    setShowInput(false)
  }

  function renderInput () {
    if (!showInput) {
      return null
    }
    const inputProps = {
      ref: inputRef,
      value: inputValue,
      onChange: handleChange,
      className: 'width-100 quick-connect-input',
      onEnter: handleConnect,
      placeholder: 'ssh|rdp|vnc|spice|serial|http|https://[username]:[password]@host:port?opts={...}'
    }
    const iconProps = {
      onClick: handleConnect,
      title: e('connect'),
      icon: <ArrowRightOutlined />
    }
    return (
      <Space.Compact className='pd1y pd2x width-100'>
        <InputAutoFocus {...inputProps} />
        <Button
          {...iconProps}
        />
      </Space.Compact>
    )
  }
  const wiki = 'https://github.com/electerm/electerm/wiki/quick-connect'

  const btnProps = {
    onClick: handleToggle,
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

import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { copy } from '../../common/clipboard'
import Link from '../common/external-link'
import { Tag, Popconfirm, Button, Alert } from 'antd'
import {
  CopyOutlined,
  PlayCircleOutlined,
  FlagOutlined,
  FlagFilled
} from '@ant-design/icons'
import getBrand from './get-brand'

const e = window.translate

const enableAIFlag = !!(window.et && window.et.enableAIFlag)

export default function AIOutput ({ item }) {
  const outputRef = useRef(null)
  const {
    response,
    baseURLAI,
    nameAI,
    modelAI
  } = item

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [response])

  if (!response && !(item.flagged && enableAIFlag)) {
    return null
  }

  const { brand, brandUrl } = getBrand(baseURLAI)

  const renderCode = (props) => {
    const { node, className = '', children, ...rest } = props
    const code = String(children).replace(/\n$/, '')
    const inline = !className.includes('language-')
    if (inline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    }

    const copyToClipboard = () => {
      copy(code)
    }

    const runInTerminal = () => {
      // Filter out comments from the code before running
      const filteredCode = code
        .split('\n')
        .map(line => line.trim())
        .filter(line => {
          // Remove empty lines and comments
          if (!line) {
            return false
          }
          if (line.startsWith('#')) {
            return false
          }
          return true
        })
        .join('\n') // Join multiple commands with &&

      if (filteredCode) {
        window.store.runCommandInTerminal(filteredCode)
      }
    }

    return (
      <div className='code-block'>
        <div className='code-block-actions alignright'>
          <CopyOutlined
            className='code-action-icon pointer iblock'
            onClick={copyToClipboard}
            title={e('copy')}
          />
          <PlayCircleOutlined
            className='code-action-icon pointer mg1l iblock'
            onClick={runInTerminal}
          />
        </div>
        <pre>
          <code className={className} {...rest}>
            {children}
          </code>
        </pre>
      </div>
    )
  }

  function handleToggleFlag () {
    const index = window.store.aiChatHistory.findIndex(i => i.id === item.id)
    if (index === -1) {
      return
    }
    window.store.aiChatHistory[index].flagged = !window.store.aiChatHistory[index].flagged
    window.store.aiChatHistory = [...window.store.aiChatHistory]
  }

  function renderFlag () {
    if (!enableAIFlag) {
      return null
    }
    return (
      <div className={'ai-stream-output-flag' + (item.flagged ? ' is-flagged' : '')}>
        <Popconfirm
          title={item.flagged ? 'Remove the harmful-info flag?' : 'Flag this as harmful info?'}
          okText='Confirm'
          cancelText='Cancel'
          onConfirm={handleToggleFlag}
        >
          <Button
            size='small'
            type='text'
            icon={item.flagged ? <FlagFilled /> : <FlagOutlined />}
            onClick={(evt) => evt.stopPropagation()}
          />
        </Popconfirm>
      </div>
    )
  }

  function renderBrand () {
    if (!brand) {
      return null
    }
    const nameLabel = nameAI || modelAI
    const label = nameLabel ? `${brand}:${nameLabel}` : brand
    return (
      <div className='pd1y'>
        <Link to={brandUrl}>
          <Tag>{label}</Tag>
        </Link>
      </div>
    )
  }

  const mdProps = {
    children: response,
    components: {
      code: renderCode
    }
  }

  return (
    <div className='ai-stream-output' ref={outputRef}>
      {renderFlag()}
      <div className='pd1'>
        {item.flagged && enableAIFlag
          ? <Alert type='warning' message='user flagged as harmful info' />
          : (
            <>
              {renderBrand()}
              <ReactMarkdown {...mdProps} />
            </>
            )}
      </div>
    </div>
  )
}

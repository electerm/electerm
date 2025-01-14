import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { copy } from '../../common/clipboard'
import Link from '../common/external-link'
import { Tag } from 'antd'
import { CopyOutlined, PlayCircleOutlined, DownCircleOutlined } from '@ant-design/icons'
import getBrand from './get-brand'

const e = window.translate

export default function AIOutput ({ item }) {
  const [showFull, setShowFull] = useState(false)
  const {
    response,
    baseURLAI
  } = item
  if (!response) {
    return null
  }

  const { brand, brandUrl } = getBrand(baseURLAI)

  const truncatedResponse = useMemo(() => {
    if (!response) return ''
    const codeBlockRegex = /```[\s\S]*?```/
    const match = response.match(codeBlockRegex)
    if (match) {
      const index = match.index + match[0].length
      return response.slice(0, index) + '\n\n... ...'
    }
    // If no code block found, show first 5 lines
    return response.split('\n').slice(0, 5).join('\n') + '\n\n... ...'
  }, [response])

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
      window.store.runCommandInTerminal(code)
    }

    return (
      <div className='code-block'>
        <pre>
          <code className={className} {...rest}>
            {children}
          </code>
        </pre>
        <div className='code-block-actions'>
          <CopyOutlined
            className='code-action-icon pointer'
            onClick={copyToClipboard}
            title={e('copy')}
          />
          <PlayCircleOutlined
            className='code-action-icon pointer mg1l'
            onClick={runInTerminal}
          />
        </div>
      </div>
    )
  }

  function renderBrand () {
    if (!brand) {
      return null
    }
    return (
      <div className='pd1y'>
        <Link to={brandUrl}>
          <Tag>{brand}</Tag>
        </Link>
      </div>
    )
  }

  function renderShowMore () {
    if (showFull) {
      return null
    }
    return (
      <span
        onClick={() => setShowFull(true)}
        className='mg1t pointer'
      >
        <DownCircleOutlined /> {e('fullContent')}
      </span>
    )
  }

  const mdProps = {
    children: showFull ? response : truncatedResponse,
    components: {
      code: renderCode
    }
  }

  return (
    <div className='pd1'>
      {renderBrand()}
      <ReactMarkdown {...mdProps} />
      {renderShowMore()}
    </div>
  )
}

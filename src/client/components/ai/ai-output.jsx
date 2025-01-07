import React from 'react'
import ReactMarkdown from 'react-markdown'
import { copy } from '../../common/clipboard'
import Link from '../common/external-link'
import { Tag } from 'antd'
import { CopyOutlined, PlayCircleOutlined } from '@ant-design/icons'

const brands = {
  openai: 'https://openai.com',
  deepseek: 'https://deepseek.com'
}

export default function AIOutput ({ content, brand }) {
  if (!content) {
    return null
  }

  const renderCode = ({ node, inline, className, children, ...props }) => {
    const code = String(children).replace(/\n$/, '')

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
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
        <div className='code-block-actions'>
          <CopyOutlined
            className='code-action-icon pointer'
            onClick={copyToClipboard}
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
    const link = brands[brand.toLowerCase()]
    return (
      <Link to={link}>
        <Tag>{brand}</Tag>
      </Link>
    )
  }

  const mdProps = {
    children: content,
    components: {
      code: renderCode
    }
  }

  return (
    <div className='pd1'>
      <p>
        {renderBrand()}
      </p>
      <ReactMarkdown {...mdProps} />
    </div>
  )
}

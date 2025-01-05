import React from 'react'
import ReactMarkdown from 'react-markdown'
import { copy } from '../../common/clipboard'
import { CopyOutlined, PlayCircleOutlined } from '@ant-design/icons'

export default function AIOutput ({ content }) {
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

  const mdProps = {
    children: content,
    components: {
      code: renderCode
    }
  }

  return <ReactMarkdown {...mdProps} />
}

import { useState } from 'react'
import { Tag } from 'antd'
import {
  CaretDownOutlined,
  CaretRightOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DatabaseOutlined
} from '@ant-design/icons'

const toolIcons = {
  send_terminal_command: CodeOutlined,
  get_terminal_output: CodeOutlined,
  open_local_terminal: CodeOutlined,
  list_tabs: CodeOutlined,
  get_active_tab: CodeOutlined,
  switch_tab: CodeOutlined,
  list_bookmarks: DatabaseOutlined,
  open_bookmark: DatabaseOutlined,
  add_bookmark: DatabaseOutlined
}

function formatResult (result) {
  if (!result) return ''
  try {
    const parsed = JSON.parse(result)
    if (parsed.output) return parsed.output
    return JSON.stringify(parsed, null, 2)
  } catch {
    return result
  }
}

export default function AgentToolCallCard ({ toolCall }) {
  const [expanded, setExpanded] = useState(toolCall.status === 'running')
  const { name, args, status, result } = toolCall
  const Icon = toolIcons[name] || CodeOutlined

  function renderStatus () {
    if (status === 'running') {
      return <LoadingOutlined className='agent-tool-status-running' />
    }
    if (status === 'completed') {
      return <CheckCircleOutlined className='agent-tool-status-completed' />
    }
    return <CloseCircleOutlined className='agent-tool-status-error' />
  }

  function renderTag () {
    const color = status === 'running' ? 'processing' : status === 'completed' ? 'success' : 'error'
    return (
      <Tag color={color} className='agent-tool-tag'>
        {status}
      </Tag>
    )
  }

  return (
    <div className={`agent-tool-call-card agent-tool-${status}`}>
      <div
        className='agent-tool-header pointer'
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        <Icon className='mg1l' />
        <span className='mg1l agent-tool-name'>{name}</span>
        {renderTag()}
        {renderStatus()}
      </div>
      {expanded && (
        <div className='agent-tool-detail'>
          {args && Object.keys(args).length > 0 && (
            <div className='agent-tool-args'>
              <div className='agent-tool-label'>Arguments:</div>
              <pre className='agent-tool-pre'>{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {result && (
            <div className='agent-tool-result'>
              <div className='agent-tool-label'>Result:</div>
              <pre className='agent-tool-pre'>{formatResult(result)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

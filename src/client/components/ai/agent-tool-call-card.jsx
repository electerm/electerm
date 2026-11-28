import { useState, memo } from 'react'
import {
  RightOutlined,
  LoadingOutlined,
  StopOutlined,
  CheckOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import CopyIcon from './copy-icon'

const statusIcons = {
  running: LoadingOutlined,
  stopped: StopOutlined,
  completed: CheckOutlined,
  error: CloseCircleOutlined
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

function renderPre (label, text) {
  if (!text) return null
  return (
    <div>
      <div className='agent-tool-label'>{label}</div>
      <div className='agent-tool-pre-wrap'>
        <CopyIcon text={text} className='agent-tool-copy' />
        <pre className='agent-tool-pre'>{text}</pre>
      </div>
    </div>
  )
}

export default memo(function AgentToolCallCard ({ toolCall }) {
  const [expanded, setExpanded] = useState(false)
  const { name, args, status, result } = toolCall
  const StatusIcon = statusIcons[status] || CloseCircleOutlined
  const label = status === 'stopped' ? window.translate('stopped') : status

  return (
    <div className={`agent-tool-call-card agent-tool-${status}`}>
      <button
        type='button'
        className='agent-tool-header ai-transcript-button'
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon className={`agent-tool-status-${status}`} />
        <span className='agent-tool-name'>{name}</span>
        <span className='agent-tool-status'>{label}</span>
        <RightOutlined className='ai-disclosure-arrow' />
      </button>
      {expanded && (
        <div className='agent-tool-detail'>
          {args && Object.keys(args).length > 0 && renderPre('Arguments', JSON.stringify(args, null, 2))}
          {renderPre('Result', formatResult(result))}
        </div>
      )}
    </div>
  )
})

import { Tooltip } from 'antd'
import {
  formatTokens,
  formatPercent,
  getUsageLevel,
  CONTEXT_WARN_PERCENT
} from './ai-context'

// How full the context window is, as a small bar + count, with the breakdown
// in the tooltip. The number is what the next request will carry, so it is
// the one to watch before pressing Compress.
export default function AiContextIndicator ({ info }) {
  if (!info || !info.tokens) {
    return null
  }
  const {
    tokens,
    messagesTokens,
    toolsTokens,
    windowSize,
    windowSource,
    percent,
    measuredTokens
  } = info
  const level = getUsageLevel(percent)
  const width = Math.min(100, Math.max(2, percent || 0))

  function renderWindowSource () {
    if (windowSource === 'config') {
      return `window ${formatTokens(windowSize)}, set in AI config`
    }
    if (windowSource === 'model') {
      return `window ${formatTokens(windowSize)}, from the model name`
    }
    return `window assumed to be ${formatTokens(windowSize)} — set "Context length" in AI config if your model differs`
  }

  const tip = (
    <div className='ai-context-tip'>
      <div className='ai-context-tip-title'>Context of the next message</div>
      <div className='ai-context-tip-row'>
        <span>system + history</span>
        <span>~{formatTokens(messagesTokens)}</span>
      </div>
      {toolsTokens > 0 && (
        <div className='ai-context-tip-row'>
          <span>agent tools</span>
          <span>~{formatTokens(toolsTokens)}</span>
        </div>
      )}
      <div className='ai-context-tip-row ai-context-tip-total'>
        <span>total</span>
        <span>~{formatTokens(tokens)} ({formatPercent(percent)})</span>
      </div>
      {measuredTokens > 0 && (
        <div className='ai-context-tip-row'>
          <span>last request, measured</span>
          <span>{measuredTokens.toLocaleString()}</span>
        </div>
      )}
      <div className='ai-context-tip-note'>{renderWindowSource()}</div>
      {(level === 'warn' || level === 'danger') && (
        <div className='ai-context-tip-warn'>
          Over {CONTEXT_WARN_PERCENT}% — use Compress to summarize the session.
        </div>
      )}
    </div>
  )

  return (
    <Tooltip title={tip}>
      <span className={`ai-context-indicator ai-context-${level}`}>
        <span className='ai-context-bar'>
          <span className='ai-context-bar-fill' style={{ width: width + '%' }} />
        </span>
        <span className='ai-context-count'>
          {formatTokens(tokens)}/{formatTokens(windowSize)}
        </span>
        <span className='ai-context-percent'>{formatPercent(percent)}</span>
      </span>
    </Tooltip>
  )
}

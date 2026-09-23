import { CopyOutlined } from '@ant-design/icons'
import { copy } from '../../common/clipboard'

const e = window.translate

/**
 * Always visible copy icon, shared by AI output and agent tool call blocks
 * @param {Object} props
 * @param {string} props.text - text to copy
 * @param {string} props.className - extra class for positioning
 * @param {string} props.title - tooltip title
 */
export default function CopyIcon ({ text, className = '', title }) {
  function handleCopy (evt) {
    // agent tool card header toggles expanded state on click
    evt.stopPropagation()
    copy(text)
  }

  if (!text) {
    return null
  }

  return (
    <CopyOutlined
      className={`copy-icon pointer iblock${className ? ' ' + className : ''}`}
      onClick={handleCopy}
      title={title || e('copy')}
    />
  )
}

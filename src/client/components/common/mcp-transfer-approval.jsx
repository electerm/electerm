/**
 * Approval dialog for a local file transfer requested by an MCP client.
 *
 * The transfer tools are reachable by any connected MCP/AI client, and an MCP
 * client can be steered by content it just read (a remote file it was asked to
 * summarise, terminal output). A local write or a credential read therefore
 * needs the human to see the two paths and say yes, exactly like the transfer
 * conflict dialog does for an overwrite.
 *
 * The copy is looked up by key, but a missing key falls back to the English
 * string instead of rendering the key name: this dialog is a security gate, so
 * a locale package that has not picked the keys up yet must not make it
 * unreadable.
 */

import Modal from './modal'
import './mcp-transfer-approval.styl'

// window.translate() falls back to the key name (capitalised), which would put
// "McpTransferConfirmTitle" in a security dialog. Read the dictionary instead
// and use the English string until the locale package ships the key.
const t = (key, fallback) => {
  const lang = typeof window.getLang === 'function' ? window.getLang() : null
  const val = lang && lang[key]
  return val || fallback
}

const reasonText = (code) => {
  switch (code) {
    case 'sensitive-write':
      return t(
        'mcpTransferSensitiveWrite',
        'This path is run by the system (shell rc, ssh trust store or an autostart entry). Writing it lets the other side execute code on this machine.'
      )
    case 'sensitive-read':
      return t(
        'mcpTransferSensitiveRead',
        'This path holds credentials or private keys. Uploading it hands them to the remote server.'
      )
    case 'strict-mode':
      return t(
        'mcpTransferStrictMode',
        'A command whitelist is configured, so every transfer started by an MCP client is reviewed.'
      )
    default:
      return ''
  }
}

/**
 * @param {object} spec
 * @param {'upload'|'download'} spec.direction
 * @param {string} spec.fromPath
 * @param {string} spec.toPath
 * @param {Array<{code: string}>} spec.reasons from decideTransferApproval
 * @param {string} spec.host remote host, shown so the direction is unambiguous
 * @returns {Promise<boolean>} true when the user approved
 */
export default function confirmMcpTransfer ({
  direction = 'download',
  fromPath = '',
  toPath = '',
  reasons = [],
  host = ''
}) {
  return new Promise((resolve) => {
    const download = direction === 'download'
    const title = t('mcpTransferConfirmTitle', 'MCP file transfer needs your approval')
    const fromLabel = download
      ? t('mcpTransferFromRemote', 'From remote')
      : t('mcpTransferFromLocal', 'From local')
    const toLabel = download
      ? t('mcpTransferToLocal', 'To local')
      : t('mcpTransferToRemote', 'To remote')
    const body = (
      <div className='mcp-transfer-confirm'>
        <div className='mcp-transfer-row'>
          <span>{t('mcpTransferIntro', 'An MCP client asked electerm to transfer a file. Nothing has been transferred yet.')}</span>
        </div>
        <div className='mcp-transfer-row'>
          <span className='mcp-transfer-label'>{fromLabel}</span>
          <span className='mcp-transfer-path'>{fromPath}</span>
        </div>
        <div className='mcp-transfer-row'>
          <span className='mcp-transfer-label'>{toLabel}</span>
          <span className='mcp-transfer-path'>{toPath}</span>
        </div>
        {!!host && (
          <div className='mcp-transfer-row'>
            <span className='mcp-transfer-label'>{t('host', 'host')}</span>
            <span className='mcp-transfer-path'>{host}</span>
          </div>
        )}
        {reasons.map(reason => {
          const text = reasonText(reason.code)
          return text
            ? <div key={reason.code} className='mcp-transfer-warn'>{text}</div>
            : null
        })}
      </div>
    )
    Modal.confirm({
      title,
      content: body,
      width: 520,
      okText: t('ok', 'OK'),
      cancelText: t('cancel', 'Cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })
}

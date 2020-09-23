/**
 * Transfer tag
 * @param {object} props
 */

import './transfer-tag.styl'
const { prefix } = window
const e = prefix('sftp')

export default function TransferTag (props) {
  const {
    typeTo,
    typeFrom,
    error,
    inited
  } = props.transfer
  let tagStatus = inited ? 'started' : 'init'
  if (error) {
    tagStatus = 'error'
  }
  const typeFromTitle = e(typeFrom)
  const typeToTitle = e(typeTo)
  const title = error
    ? `error: ${error}`
    : ''
  return (
    <span className={'flex-child transfer-tag transfer-status-' + tagStatus} title={title}>
      <span className='sftp-transfer-type'>
        {typeFromTitle}
      </span>
      <span className='sftp-transfer-arrow'>
        →
      </span>
      <span className='sftp-transfer-type'>
        {typeToTitle}
      </span>
    </span>
  )
}

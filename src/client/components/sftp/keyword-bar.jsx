/**
 * Shows the active type-to-filter keyword above a file list,
 * similar to the "Contains: xxx" bar in OneCommander.
 */

import { CloseOutlined } from '@ant-design/icons'

const e = window.translate

export default function KeywordBar ({ keyword, type, updateKeyword }) {
  if (!keyword) {
    return null
  }
  return (
    <div className='sftp-keyword-bar pd1x'>
      <span className='sftp-keyword-bar-text elli'>
        {e('contains')}: <b>{keyword}</b>
      </span>
      <CloseOutlined
        className='sftp-keyword-bar-close pointer'
        onClick={() => updateKeyword('', type)}
      />
    </div>
  )
}

/**
 * Shows the active type-to-filter keyword above a file list.
 * A filter icon stands in for a "contains:" label so that no extra
 * locale key is needed.
 */

import { CloseOutlined, FilterOutlined } from '@ant-design/icons'

export default function KeywordBar ({ keyword, type, updateKeyword }) {
  if (!keyword) {
    return null
  }
  return (
    <div className='sftp-keyword-bar pd1x'>
      <FilterOutlined className='sftp-keyword-bar-icon mg1r' />
      <span className='sftp-keyword-bar-text elli'>
        <b>{keyword}</b>
      </span>
      <CloseOutlined
        className='sftp-keyword-bar-close pointer'
        onClick={() => updateKeyword('', type)}
      />
    </div>
  )
}

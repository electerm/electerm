/**
 * Copy connection details or the whole bookmark.
 */
import { useState } from 'react'
import { Dropdown } from 'antd'
import { CopyOutlined, ShareAltOutlined } from '@ant-design/icons'
import { copy } from '../../common/clipboard'
import { stringifyQuickConnect } from '../../common/quick-connect-string'

const e = window.translate

const maxLen = 50

function sftpLink ({ type = 'ssh', host, port, username, startDirectory = '' }) {
  if (type !== 'ssh' || !host) {
    return ''
  }
  const user = username ? encodeURIComponent(username) + '@' : ''
  const hostname = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  const portPart = port && Number(port) !== 22 ? ':' + port : ''
  const path = startDirectory && startDirectory.split('/').map(encodeURIComponent).join('/')
  return `sftp://${user}${hostname}${portPart}${path ? '/' + path.replace(/^\//, '') : ''}`
}

function oneLine (str) {
  const s = String(str || '').replace(/\s+/g, ' ').trim()
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s
}

function label (name, value) {
  return (
    <span title={value}>
      <b className='mg1r'>{name}</b>
      <span>{oneLine(value)}</span>
      <CopyOutlined className='mg1l' />
    </span>
  )
}

export default function CopyBookmark ({ getValues, className }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])

  const getStrings = () => {
    const values = getValues() || {}
    return {
      sftp: sftpLink(values),
      quickConnect: stringifyQuickConnect(values),
      json: JSON.stringify(values, null, 2)
    }
  }

  const onOpenChange = (next) => {
    setOpen(next)
    if (!next) {
      return
    }
    const { sftp, quickConnect, json } = getStrings()
    const items = [
      {
        key: 'quickConnect',
        disabled: !quickConnect,
        label: label(e('quickConnect'), quickConnect)
      },
      {
        key: 'json',
        label: label('JSON', json)
      }
    ]
    if (sftp) {
      items.unshift({ key: 'sftp', label: label('SFTP URL', sftp) })
    }
    setItems(items)
  }

  const onClick = ({ key }) => {
    const value = getStrings()[key]
    if (value) {
      copy(value)
    }
    setOpen(false)
  }

  return (
    <Dropdown
      menu={{ items, onClick }}
      open={open}
      onOpenChange={onOpenChange}
      trigger={['click']}
      placement='bottomRight'
    >
      <ShareAltOutlined className={className} title={e('copy')} />
    </Dropdown>
  )
}

/**
 * Copy the bookmark form's current values: as a quick connect string, or as
 * the raw JSON that lands in the config file.
 */
import { useState } from 'react'
import { Dropdown } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { copy } from '../../common/clipboard'
import { stringifyQuickConnect } from '../../common/quick-connect-string'

const e = window.translate

const maxLen = 50

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

export default function CopyBookmark ({ getValues }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])

  const getStrings = () => {
    const values = getValues() || {}
    return {
      quickConnect: stringifyQuickConnect(values),
      json: JSON.stringify(values, null, 2)
    }
  }

  const onOpenChange = (next) => {
    setOpen(next)
    if (!next) {
      return
    }
    const { quickConnect, json } = getStrings()
    setItems([
      {
        key: 'quickConnect',
        disabled: !quickConnect,
        label: label(e('quickConnect'), quickConnect)
      },
      {
        key: 'json',
        label: label('JSON', json)
      }
    ])
  }

  const onClick = ({ key }) => {
    const { quickConnect, json } = getStrings()
    const value = key === 'json' ? json : quickConnect
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
      <span className='pointer fright' title={e('copy')}>
        <CopyOutlined />
      </span>
    </Dropdown>
  )
}

import { useState } from 'react'
import { Input, Popover } from 'antd'
import { CloseOutlined, UnorderedListOutlined } from '@ant-design/icons'
import createTitle from '../../common/create-title'

const e = window.translate

export default function SessionList ({ tabs, config, batch }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const search = query.trim().toLowerCase()

  function changeOpen (next) {
    setOpen(next)
    if (!next) setQuery('')
  }

  function selectTab (id) {
    window.store[`activeTabId${batch}`] = id
    changeOpen(false)
  }

  const rows = tabs.map(tab => {
    const title = createTitle(tab)
    const label = config?.disableTabIndex ? title : `${tab.tabCount}. ${title}`
    if (!label.toLowerCase().includes(search)) return null
    return (
      <div className='session-list-row' key={tab.id}>
        <button type='button' className='session-list-title' title={label} onClick={() => selectTab(tab.id)}>
          <span aria-hidden='true' style={{ color: tab.color }}>● </span>{label}
        </button>
        <button type='button' className='session-list-close' title={e('close')} aria-label={`${e('close')} ${label}`} onClick={() => window.store.delTab(tab.id)}>
          <CloseOutlined />
        </button>
      </div>
    )
  }).filter(Boolean)

  return (
    <Popover
      trigger='click'
      placement='bottomRight'
      open={open}
      onOpenChange={changeOpen}
      destroyOnHidden
      content={
        <div className='session-list'>
          <Input
            autoFocus
            allowClear
            aria-label={e('search')}
            placeholder={e('search')}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <div className='session-list-results'>
            {rows.length ? rows : e('noData')}
          </div>
        </div>
      }
    >
      <button type='button' className='tabs-dd-icon session-list-trigger' title={e('sessions')} aria-label={e('sessions')} aria-expanded={open}>
        <UnorderedListOutlined />
      </button>
    </Popover>
  )
}

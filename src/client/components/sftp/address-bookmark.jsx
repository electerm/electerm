import { auto } from 'manate/react'
import { useState } from 'react'
import {
  StarOutlined,
  PlusSquareOutlined,
  GlobalOutlined,
  DesktopOutlined
} from '@ant-design/icons'
import {
  Popover,
  Switch,
  Space
} from 'antd'
import AddrBookmarkItem from './address-bookmark-item'
import { typeMap } from '../../common/constants'
import uid from '../../common/uid'
import './address-bookmark.styl'

export default auto(function AddrBookmark (props) {
  const [isGlobalMode, setIsGlobalMode] = useState(false)

  function onDel (item) {
    window.store.delAddressBookmark(item)
  }

  function handleAddAddr () {
    const {
      host, realPath, type
    } = props
    const bookmarkData = {
      addr: realPath,
      id: uid()
    }
    
    if (isGlobalMode && type !== typeMap.local) {
      // Global bookmark
      bookmarkData.global = true
      bookmarkData.host = ''
    } else {
      // Host-specific or local bookmark
      bookmarkData.host = type === typeMap.local ? '' : host
    }
    
    window.store.addAddressBookmark(bookmarkData)
  }

  function handleToggleMode (checked) {
    setIsGlobalMode(checked)
  }

  const { type, onClickHistory, host } = props
  const { store } = window
  
  let addrs
  if (type === typeMap.local) {
    addrs = store.addressBookmarksLocal
  } else if (isGlobalMode) {
    addrs = store.addressBookmarksGlobal
  } else {
    addrs = store.addressBookmarks.filter(g => g.host === host)
  }
  const inner = addrs.length
    ? addrs.map(o => {
      return (
        <AddrBookmarkItem
          handleClick={onClickHistory}
          type={type}
          key={o.id}
          handleDel={onDel}
          item={o}
        />
      )
    })
    : null
  const content = (
    <div
      className='addr-bookmark-list'
    >
      {type !== typeMap.local && (
        <div className='addr-bookmark-toggle' style={{ marginBottom: 8, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space size="small">
            <DesktopOutlined />
            <Switch
              size="small"
              checked={isGlobalMode}
              onChange={handleToggleMode}
              checkedChildren={<GlobalOutlined />}
              unCheckedChildren={<DesktopOutlined />}
            />
            <GlobalOutlined />
            <span style={{ fontSize: '12px', color: '#666' }}>
              {isGlobalMode ? 'Global' : 'Host-specific'}
            </span>
          </Space>
        </div>
      )}
      {inner}
    </div>
  )
  const title = (
    <PlusSquareOutlined
      className='add-addr-bookmark'
      onClick={handleAddAddr}
    />
  )
  return (
    <Popover
      content={content}
      title={title}
      placement='bottom'
      trigger='click'
    >
      <StarOutlined />
    </Popover>
  )
})

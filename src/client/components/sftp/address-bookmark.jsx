import { auto } from 'manate/react'
import { useState } from 'react'
import {
  StarOutlined,
  PlusSquareOutlined
} from '@ant-design/icons'
import {
  Popover,
  Switch
} from 'antd'
import AddrBookmarkItem from './address-bookmark-item'
import { typeMap } from '../../common/constants'
import uid from '../../common/uid'
import './address-bookmark.styl'

const e = window.translate

export default auto(function AddrBookmark (props) {
  const [isGlobalMode, setIsGlobalMode] = useState(false)
  
  function onDel (item) {
    window.store.delAddressBookmark(item)
  }

  function handleAddAddr () {
    const {
      host, realPath, type
    } = props
    window.store.addAddressBookmark(
      {
        addr: realPath,
        host: type === typeMap.local ? '' : host,
        isGlobal: type === typeMap.remote && isGlobalMode,
        id: uid()
      }
    )
  }

  function handleToggleGlobal (checked) {
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
      {inner}
    </div>
  )
  
  const title = type === typeMap.remote
    ? (
      <div className='addr-bookmark-header'>
        <div className='addr-bookmark-toggle'>
          <span className='toggle-label'>{isGlobalMode ? 'Global' : 'Host-specific'}</span>
          <Switch
            size='small'
            checked={isGlobalMode}
            onChange={handleToggleGlobal}
          />
        </div>
        <PlusSquareOutlined
          className='add-addr-bookmark'
          onClick={handleAddAddr}
        />
      </div>
    )
    : (
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

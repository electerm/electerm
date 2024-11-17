import { auto } from 'manate/react'
import {
  StarOutlined,
  PlusSquareOutlined
} from '@ant-design/icons'
import {
  Popover
} from 'antd'
import AddrBookmarkItem from './address-bookmark-item'
import { typeMap } from '../../common/constants'
import uid from '../../common/uid'
import './address-bookmark.styl'

export default auto(function AddrBookmark (props) {
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
        id: uid()
      }
    )
  }

  const { type, onClickHistory, host } = props
  const { store } = window
  // const cls = classnames(
  //   'sftp-history',
  //   'animated',
  //   `sftp-history-${type}`
  // )
  const addrs = type === typeMap.local
    ? store.addressBookmarksLocal
    : store.addressBookmarks.filter(
      g => g.host === host
    )
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
  const title = (
    <div>
      <PlusSquareOutlined
        className='add-addr-bookmark'
        onClick={handleAddAddr}
      />
    </div>
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

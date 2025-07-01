import { auto } from 'manate/react'
import {
  StarOutlined,
  PlusSquareOutlined
} from '@ant-design/icons'
import {
  Popover,
  Button
} from 'antd'
import AddrBookmarkItem from './address-bookmark-item'
import { typeMap } from '../../common/constants'
import uid from '../../common/uid'
import './address-bookmark.styl'

export default auto(function AddrBookmark (props) {
  function onDel (item) {
    window.store.delAddressBookmark(item)
  }

  function handleAddAddrAct (isGlobal = false) {
    const {
      host, realPath, type
    } = props
    window.store.addAddressBookmark(
      {
        addr: realPath,
        host: type === typeMap.local ? '' : host,
        isGlobal,
        id: uid()
      }
    )
  }

  function handleAddAddr () {
    handleAddAddrAct(false)
  }

  function handleAddAddrGlob () {
    handleAddAddrAct(true)
  }

  const { type, onClickHistory, host } = props
  const { store } = window
  // const cls = classnames(
  //   'sftp-history',
  //   'animated',
  //   `sftp-history-${type}`
  // )
  const isLocal = type === typeMap.local
  const addrs = isLocal
    ? store.addressBookmarksLocal
    : store.addressBookmarks.filter(
      g => {
        return g.isGlobal || g.host === host
      }
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
  const globButton = isLocal
    ? null
    : (
      <Button
        onClick={handleAddAddrGlob}
        icon={<PlusSquareOutlined />}
      >
        {window.translate('global')}
      </Button>
      )
  const title = (
    <div>
      <Button
        className='add-addr-bookmark mg1r'
        onClick={handleAddAddr}
        icon={<PlusSquareOutlined />}
      />
      {globButton}
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

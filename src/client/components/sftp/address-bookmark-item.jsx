import { Component } from 'react'
import {
  CloseCircleOutlined
} from '@ant-design/icons'

export default class AddrBookmarkItem extends Component {
  handleClick = () => {
    const {
      handleClick,
      item,
      type
    } = this.props
    handleClick(
      type, item.addr
    )
  }

  handleDel = (e) => {
    e.stopPropagation()
    const {
      handleDel,
      item
    } = this.props
    handleDel(
      item
    )
  }

  handleDragOver = e => {
    e.preventDefault()
  }

  handleDragStart = e => {
    e.dataTransfer.setData('idDragged', e.target.getAttribute('data-id'))
  }

  handleDrop = e => {
    e.preventDefault()
    const { store } = window
    const [host, idDragged] = e.dataTransfer.getData('idDragged').split('#')
    const idDrop = e.target.getAttribute('data-id').split('#')[1]
    const addressBookmarks = host
      ? store.addressBookmarks
      : store.addressBookmarksLocal
    const dataName = host
      ? 'addressBookmarks'
      : 'addressBookmarksLocal'
    const idDraggedIndex = addressBookmarks.findIndex(
      ({ id }) => id === idDragged
    )
    const targetIndex = addressBookmarks.findIndex(
      ({ id }) => id === idDrop
    )
    if (idDraggedIndex < targetIndex) {
      addressBookmarks.splice(targetIndex, 0, addressBookmarks.splice(idDraggedIndex, 1)[0])
    } else {
      addressBookmarks.splice(targetIndex + 1, 0, addressBookmarks.splice(idDraggedIndex, 1)[0])
    }
    store.setItems(dataName, addressBookmarks)
  }

  render () {
    const {
      item
    } = this.props
    const id = `${item.host}#${item.id}`
    return (
      <div
        key={item.id}
        className='sftp-history-item addr-bookmark-item'
        onClick={this.handleClick}
        data-id={id}
        draggable
        onDragOver={this.handleDragOver}
        onDragStart={this.handleDragStart}
        onDrop={this.handleDrop}
      >
        {item.addr}
        <CloseCircleOutlined
          className='del-addr-bookmark'
          onClick={this.handleDel}
        />
      </div>
    )
  }
}

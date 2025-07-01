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
    const { item } = this.props
    const draggedData = e.dataTransfer.getData('idDragged')
    const [hostOrGlobal, idDragged] = draggedData.split('#')
    const idDrop = e.target.getAttribute('data-id').split('#')[1]
    
    let dataName
    if (hostOrGlobal === 'global') {
      dataName = 'addressBookmarksGlobal'
    } else if (!hostOrGlobal) {
      dataName = 'addressBookmarksLocal'
    } else {
      dataName = 'addressBookmarks'
    }
    
    store.adjustOrder(dataName, idDragged, idDrop)
  }

  render () {
    const {
      item
    } = this.props
    const id = item.isGlobal ? `global#${item.id}` : `${item.host}#${item.id}`
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

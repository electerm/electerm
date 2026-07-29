import { Component } from 'react'
import {
  CloseCircleOutlined
} from '@ant-design/icons'
import {
  Tag
} from 'antd'
import { isDropAfterHalf, setDropIndicator, clearDropIndicator } from '../../common/drop-position'

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
    // only the hovered item should show an indicator
    document.querySelectorAll(
      '.addr-bookmark-item.dnd-before, .addr-bookmark-item.dnd-after'
    ).forEach(el => clearDropIndicator(el))
    setDropIndicator(e.currentTarget, isDropAfterHalf(e, e.currentTarget))
  }

  handleDragLeave = e => {
    clearDropIndicator(e.currentTarget)
  }

  handleDragStart = e => {
    e.dataTransfer.setData('idDragged', e.target.getAttribute('data-id'))
  }

  handleDrop = e => {
    e.preventDefault()
    clearDropIndicator(e.currentTarget)
    const { store } = window
    const [host, idDragged] = e.dataTransfer.getData('idDragged').split('#')
    const idDrop = e.currentTarget.getAttribute('data-id').split('#')[1]
    const dataName = host
      ? 'addressBookmarks'
      : 'addressBookmarksLocal'
    const insertAfter = isDropAfterHalf(e, e.currentTarget)
    store.adjustOrder(dataName, idDragged, idDrop, insertAfter)
  }

  render () {
    const {
      item
    } = this.props
    const id = `${item.host}#${item.id}`
    const globTag = item.isGlobal
      ? <Tag color='green' variant='solid'>G</Tag>
      : null
    return (
      <div
        key={item.id}
        className='sftp-history-item addr-bookmark-item'
        onClick={this.handleClick}
        data-id={id}
        draggable
        onDragOver={this.handleDragOver}
        onDragLeave={this.handleDragLeave}
        onDragStart={this.handleDragStart}
        onDrop={this.handleDrop}
      >
        {globTag}
        <b className='mg1l'>{item.addr}</b>
        <CloseCircleOutlined
          className='del-addr-bookmark'
          onClick={this.handleDel}
        />
      </div>
    )
  }
}

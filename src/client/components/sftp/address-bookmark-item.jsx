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

  render () {
    const {
      item
    } = this.props
    return (
      <div
        key={item.id}
        className='sftp-history-item addr-bookmark-item'
        onClick={this.handleClick}
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

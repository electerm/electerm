/**
 * file section
 */

import React from 'react'
import {Icon, Tooltip} from 'antd'
import classnames from 'classnames'
import moment from 'moment'

export default class FileSection extends React.Component {

  transferOrEnterDirectory = e => {
    return this.props.transferOrEnterDirectory(
      this.props.file, e
    )
  }

  transfer = e => {
    return this.props.transfer(
      this.props.file, e
    )
  }

  renderContext() {
    return <div />
  }

  onContextMenu = e => {
    e.preventDefault()
    let {target} = e
    let rect = target.getBoundingClientRect()
    debug(rect, 'rect')
    let content = this.renderContext()
    this.props.openContextMenu({
      content
    })
  }

  render() {
    let {type, file} = this.props
    let {
      name,
      size,
      isDirectory,
      modifyTime
    } = file
    let cls = classnames('sftp-item', type, {
      directory: isDirectory
    })
    let pm = type === 'remote'
      ? 'left'
      : 'right'
    let title = (
      <div>
        <p>{name}</p>
        <p>modifyTime: {moment(modifyTime).format()}</p>
      </div>
    )
    return (
      <div
        className={cls}
        onDoubleClick={this.transferOrEnterDirectory}
        onContextMenu={this.onContextMenu}
      >
        <Tooltip
          title={title}
          placement={pm}
        >
          <div className="sftp-item-title elli iblock">
            {
              isDirectory
                ? <Icon type="folder" />
                : <Icon type="file" />
            }
            <span className="mg1l">{name}</span>
          </div>
        </Tooltip>
        {
          isDirectory
            ? null
            : <div className="sftp-item-size elli iblock">{size}</div>
        }
        {
          isDirectory
            ? null
            : (
              <Tooltip title="transfer">
                <Icon
                  type={`double-${pm}`}
                  className="transport-icon"
                  onClick={this.transfer}
                />
              </Tooltip>
            )
        }
      </div>
    )
  }
}

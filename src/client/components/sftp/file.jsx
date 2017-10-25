/**
 * file section
 */

import React from 'react'
import {Icon, Tooltip} from 'antd'
import classnames from 'classnames'
import moment from 'moment'
const resolve = window.getGlobal('resolve')

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

  localDel = async (file) => {
    let {localPath} = this.props
    let {name, isDirectory} = file
    let fs = window.getGlobal('fs')
    let func = !isDirectory
      ? fs.unlinkAsync
      : fs.rmdirAsync
    let p = resolve(localPath, name)
    await func(p).catch(this.props.onError)
    this.props.localList()
  }

  remoteDel = async (file) => {
    let {remotePath} = this.props
    let {name, isDirectory} = file
    let {sftp} = this.props
    let func = isDirectory
      ? sftp.rmdir
      : sftp.rm
    let p = resolve(remotePath, name)
    await func(p).catch(this.props.onError)
    this.props.remoteList()
  }

  del = () => {
    this.props.closeContextMenu()
    let {file} = this.props
    let {type} = file
    this[type + 'Del'](file)
  }

  doTranfer = () => {
    this.props.closeContextMenu()
    return this.props.transfer(
      this.props.file
    )
  }

  renderContext() {
    let {
      file: {
        type,
        isDirectory
      }
    } = this.props
    let transferText = type === 'local'
      ? 'upload'
      : 'download'
    return (
      <div>
        {
          isDirectory
            ? null
            : (
              <div
                className="pd2x pd1y context-item pointer"
                onClick={this.doTranfer}
              >
                {transferText}
              </div>
            )
        }
        <div
          className="pd2x pd1y context-item pointer"
          onClick={this.del}
        >
          delete
        </div>
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    let {target} = e
    let rect = target.getBoundingClientRect()
    let content = this.renderContext()
    this.props.openContextMenu({
      content,
      pos: {
        left: rect.left,
        top: rect.top + 15
      }
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

/**
 * file section
 */

import React from 'react'
import {Icon, Tooltip, Popconfirm, Input} from 'antd'
import classnames from 'classnames'
import moment from 'moment'
import copy from 'json-deep-copy'
import _ from 'lodash'

const {getGlobal} = window
const resolve = getGlobal('resolve')

export default class FileSection extends React.Component {

  constructor(props) {
    super(props)
    this.state = copy(props.file)
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.file, this.props.file)) {
      this.setState({
        file: copy(nextProps.file)
      })
    }
  }

  onChange = e => {
    this
  }

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
    let fs = getGlobal('fs')
    let func = !isDirectory
      ? fs.unlinkAsync
      : fs.rmdirAsync
    let p = resolve(localPath, name)

    //if isDirectory, delete files in it fisrt
    let files = await fs.readdirAsync(p)
    if (files.length) {
      let rmrf = getGlobal('rmrf')
      func = rmrf
    }
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

  newFile = () => {

  }

  renderContext() {
    let {
      file: {
        type,
        isDirectory,
        name
      }
    } = this.props
    let transferText = type === 'local'
      ? 'upload'
      : 'download'
    let icon = type === 'local'
      ? 'cloud-upload-o'
      : 'cloud-download-o'
    let title = `are you sure? this will delete ${isDirectory ? 'directory' : 'file'} "${name}"` +
      (isDirectory ? ' and all the file/directory in it' : '')
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
                <Icon type={icon} /> {transferText}
              </div>
            )
        }
        <Popconfirm
          title={title}
          onConfirm={this.del}
        >
          <div
            className="pd2x pd1y context-item pointer"
          >
            <Icon type="close-circle" /> delete
          </div>
        </Popconfirm>
        <div
          className="pd2x pd1y context-item pointer"
          onClick={this.newFile}
        >
          <Icon type="file-add" /> new file
        </div>
        <div
          className="pd2x pd1y context-item pointer"
          onClick={this.newDirectory}
        >
          <Icon type="folder-add" /> new directory
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

  renderEditting() {
    let {
      nameTemp,
      isDirectory
    } = this.props.file
    return (
      <div className="sftp-item">
        <Input
          value={nameTemp}
          onChange={this.onChange}
        />
      </div>
    )
  }

  render() {
    let {type, file} = this.props
    let {
      name,
      size,
      isDirectory,
      modifyTime,
      isEditting
    } = file
    if (isEditting) {
      return this.renderEditting()
    }
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

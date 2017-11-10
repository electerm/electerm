/**
 * file section
 */

import React from 'react'
import {Icon, Tooltip, Popconfirm} from 'antd'
import classnames from 'classnames'
import moment from 'moment'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import resolve from '../../common/resolve'

const {getGlobal} = window

export default class FileSection extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      file: copy(props.file),
      overwriteStrategy: ''
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.file, this.props.file)) {
      this.setState({
        file: copy(nextProps.file)
      })
    }
  }

  doRename = () => {
    let file = copy(this.state.file)
    file.nameTemp = file.name
    file.isEditting = true
    this.props.closeContextMenu()
    this.setState({
      file
    })
  }

  cancelNew = (type) => {
    let list = this.props[type]
    list = list.filter(p => p.modifyTime)
    this.props.modifier({
      [type]: list
    })
  }

  localCreateNew = async file => {
    let {nameTemp, isDirectory} = file
    let {localPath} = this.props
    let p = resolve(localPath, nameTemp)
    let fs = getGlobal('fs')
    let func = isDirectory
      ? fs.mkdirAsync
      : fs.touch
    let res = await func(p)
      .then(() => true)
      .catch(this.props.onError)
    if (res) {
      this.props.localList()
    }
  }

  remoteCreateNew = async file => {
    let {nameTemp, isDirectory} = file
    let {remotePath, sftp} = this.props
    let p = resolve(remotePath, nameTemp)
    let func = isDirectory
      ? sftp.mkdir
      : sftp.touch
    let res = await func(p)
      .then(() => true)
      .catch(this.props.onError)
    if (res) {
      this.props.remoteList()
    }
  }

  createNew = file => {
    let {type} = file
    return this[`${type}CreateNew`](file)
  }

  onBlur = () => {
    let file = copy(this.state.file)
    let {nameTemp, name, modifyTime, type} = this.state.file
    if (name === nameTemp) {
      if (!modifyTime) {
        return this.cancelNew(type)
      }
      delete file.nameTemp
      delete file.isEditting
      return this.setState({
        file
      })
    }
    if (!modifyTime) {
      return this.createNew(file)
    }
    this.rename(name, nameTemp)
  }

  rename = (oldname, newname) => {
    let {type} = this.props.file
    return this[`${type}Rename`](oldname, newname)
  }

  localRename = async (oldname, newname) => {
    let {localPath} = this.props
    let fs = getGlobal('fs')
    let p1 = resolve(localPath, oldname)
    let p2 = resolve(localPath, newname)
    await fs.renameAsync(p1, p2).catch(this.props.onError)
    this.props.localList()
  }

  remoteRename = async (oldname, newname) => {
    let {remotePath, sftp} = this.props
    let p1 = resolve(remotePath, oldname)
    let p2 = resolve(remotePath, newname)
    let res = await sftp.rename(p1, p2)
      .catch(this.props.onError)
      .then(() => true)
    if (res) {
      this.props.remoteList()
    }
  }

  onChange = e => {
    let nameTemp = e.target.value
    let file = copy(this.state.file)
    file.nameTemp = nameTemp
    this.setState({
      file
    })
  }

  enterDirectory = e => {
    e.stopPropagation()
    let {type, name} = this.state.file
    let n = `${type}Path`
    let path = this.props[n]
    let np = resolve(path, name)
    this.props.modifier({
      [n]: np,
      [n + 'Temp']: np
    }, this.props[`${type}List`])
  }

  transferOrEnterDirectory = (e) => {
    let {isDirectory} = this.state.file
    if (isDirectory) {
      return this.enterDirectory(e)
    }
    this.transfer()
  }

  getTransferList = async (file) => {
    let {isDirectory, name, path, type} = file
    if (!isDirectory) {
      return [file]
    }
    let p = resolve(path, name)
    let files = await this.props[`${type}List`](true, p)
    let res = [file]
    for (let f of files) {
      let cs = await this.getTransferList(f)
      res = [...res, ...cs]
    }
    return res
  }

  transfer = async () => {
    let arr = await this.getTransferList(this.state.file)
    this.props.modifier({
      filesToConfirm: arr
    })
  }

  doEnterDirectory = (e) => {
    this.props.closeContextMenu()
    this.enterDirectory(e)
  }

  localDel = async (file) => {
    let {localPath} = this.props
    let {name, isDirectory} = file
    let fs = getGlobal('fs')
    let func = !isDirectory
      ? fs.unlinkAsync
      : fs.rmrf
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

  refresh = () => {
    this.props.closeContextMenu()
    this.props.onGoto(this.props.file.type)
  }

  del = () => {
    this.props.closeContextMenu()
    let {file} = this.props
    let {type} = file
    this[type + 'Del'](file)
  }

  doTransfer = () => {
    this.props.closeContextMenu()
    this.transfer()
  }

  newFile = () => {
    return this.newItem(false)
  }

  newDirectory = () => {
    return this.newItem(true)
  }

  newItem = (isDirectory) => {
    let {type} = this.state.file
    let list = this.props[type]
    list.unshift({
      name: '',
      nameTemp: '',
      isDirectory,
      isEditting: true,
      type
    })
    this.props.closeContextMenu()
    this.props.modifier({
      [type]: list
    })
  }

  renderContext() {
    let {
      file: {
        type,
        isDirectory,
        name,
        modifyTime
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
          isDirectory && modifyTime
            ? (
              <div
                className="pd2x pd1y context-item pointer"
                onClick={this.doEnterDirectory}
              >
                <Icon type="enter" /> enter
              </div>
            )
            : null
        }
        {
          !modifyTime
            ? null
            : (
              <div
                className="pd2x pd1y context-item pointer"
                onClick={this.doTransfer}
              >
                <Icon type={icon} /> {transferText}
              </div>
            )
        }
        {
          modifyTime
            ? (
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
            )
            : null
        }
        {
          modifyTime
            ? (
              <div
                className="pd2x pd1y context-item pointer"
                onClick={this.doRename}
              >
                <Icon type="edit" /> rename
              </div>
            )
            : null
        }
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
        <div
          className="pd2x pd1y context-item pointer"
          onClick={this.refresh}
        >
          <Icon type="reload" /> refresh
        </div>
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    let {target} = e
    let {modifyTime} = this.props.file
    let rect = target.getBoundingClientRect()
    let {clientX, clientY} = e
    let content = this.renderContext()
    this.props.openContextMenu({
      content,
      pos: {
        left: modifyTime ? rect.left : clientX,
        top: modifyTime ? rect.top + 15 : clientY
      }
    })
  }

  renderEditting(file) {
    let {
      nameTemp,
      isDirectory
    } = file
    let icon = isDirectory ? 'folder' : 'file'
    let pre = <Icon type={icon} />
    return (
      <div className="sftp-item">
        <Input
          value={nameTemp}
          addonBefore={pre}
          onChange={this.onChange}
          onBlur={this.onBlur}
          onPressEnter={this.onBlur}
        />
      </div>
    )
  }

  render() {
    let {type} = this.props
    let {file} = this.state
    let {
      name,
      size,
      isDirectory,
      modifyTime,
      isEditting
    } = file
    if (isEditting) {
      return this.renderEditting(file)
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
      </div>
    )
  }
}

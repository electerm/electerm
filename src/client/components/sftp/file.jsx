/**
 * file section
 */

import React from 'react'
import ReactDOM from 'react-dom'
import {Icon, Tooltip, Popconfirm} from 'antd'
import {generate} from 'shortid'
import classnames from 'classnames'
import moment from 'moment'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import resolve from '../../common/resolve'
import {addClass, removeClass, hasClass} from '../../common/class'
import wait from '../../common/wait'
import {contextMenuHeight, contextMenuPaddingTop, isWin, transferTypeMap, typeMap} from '../../common/constants'
import sorter from '../../common/index-sorter'
import {getLocalFileInfo, getFolderFromFilePath, getRemoteFileInfo} from './file-read'
import {readClipboard, copy as copyToClipboard, hasFileInClipboardText} from '../../common/clipboard'

const {getGlobal} = window
let fs = getGlobal('fs')

const computePos = (e, isBg, height) => {
  let {target} = e
  let rect = target.getBoundingClientRect()
  let {clientX, clientY} = e
  let res = {
    left: isBg ? rect.left : clientX,
    top: isBg ? rect.top + 15 : clientY
  }
  if (window.innerHeight < res.top + height + 10) {
    res.top = res.top - height
  }
  return res
}

const fileItemCls = 'sftp-item'
const onDragCls = 'sftp-ondrag'
const onDragOverCls = 'sftp-dragover'

export default class FileSection extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      file: copy(props.file),
      overwriteStrategy: ''
    }
  }

  componentDidMount() {
    this.dom = ReactDOM.findDOMNode(this)
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.file, this.props.file)) {
      this.setState({
        file: copy(nextProps.file)
      })
    }
  }

  duplicate = async (fromFile, toFile) => {
    let {type, path, name} = toFile
    let base = resolve(path, name)
    let {selectedFiles} = this.props
    for(let f of selectedFiles) {
      let from = resolve(f.path, f.name)
      let exist = _.some(
        this.props[type],
        ff => {
          return ff.name === f.name && ff.isDirectory === f.isDirectory
        }
      )
      let to = exist
        ? resolve(
          base,
          'copy_' + generate() + '_' + f.name
        )
        : resolve(base, f.name)
      let func = type === typeMap.remote
        ? this.props.sftp.cp
        : fs.cp
      await func(from, to)
        .catch(this.props.onError)
    }
    this.props[type + 'List']()
  }

  onCopy = (targetFiles) => {
    let {file} = this.state
    let selected = this.isSelected(file)
    let files = targetFiles || selected
      ? this.props.selectedFiles
      : [file]
    let prefix = file.type === typeMap.remote
      ? 'remote:'
      : ''
    let textToCopy = files.map(f => {
      return prefix + resolve(f.path, f.name)
    }).join('\n')
    copyToClipboard(textToCopy)
    this.props.closeContextMenu()
  }

  onPaste = async () => {
    this.props.closeContextMenu()
    let clickBoardText = readClipboard()
    let fileNames = clickBoardText.split('\n')
    let res = []
    for (let i = 0, len = fileNames.length; i < len; i++) {
      let item = fileNames[i]
      let isRemote = item.startsWith('remote:')
      let path = isRemote
        ? item.replace(/^remote:/, '')
        : item
      let fileObj = isRemote
        ? await getRemoteFileInfo(this.props.sftp, path)
        : await getLocalFileInfo(path)
      res.push(fileObj)
    }
    await new Promise((resolve) => {
      this.props.modifier({
        selectedFiles: res
      }, resolve)
    })
    let {type} = this.state.file
    let toFile = {
      type,
      ...getFolderFromFilePath(this.props[type + 'Path']),
      isDirectory: false
    }
    let fromFile = res[0]
    let {type: fromType} = fromFile
    let {
      type: toType
    } = toFile

    //same side and drop to file, do nothing
    if (fromType === toType) {
      return this.duplicate(fromFile, toFile)
    }

    //other side, do transfer
    this.transferDrop(fromFile, toFile)
  }

  onDrag = () => {
    addClass(this.dom, onDragCls)
  }

  onDragEnter = e => {
    let {target} = e
    if (
      !hasClass(target, fileItemCls)
    ) {
      return e.preventDefault()
    }
    this.dropTarget = target
    addClass(target, onDragOverCls)
  }

  onDragExit = () => {

  }

  onDragLeave = e => {
    let {target} = e
    removeClass(target, onDragOverCls)
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragStart = e => {
    e.dataTransfer.setData('fromFile', JSON.stringify(this.props.file))
  }

  getDropFileList = async data => {
    let fromFile = data.getData('fromFile')
    if (fromFile) {
      return JSON.parse(fromFile)
    }
    let {files} = data
    let res = []
    for (let i = 0, len = files.length; i < len; i++) {
      let item = files[i]
      if (!item) {
        continue
      }
      //let file = item.getAsFile()
      let fileObj = await getLocalFileInfo(item.path)
      res.push(fileObj)
    }
    return new Promise((resolve) => {
      this.props.modifier({
        selectedFiles: res
      }, () => resolve(res[0]))
    })
  }

  onDrop = async e => {
    e.preventDefault()
    let {target} = e
    if (!target) {
      return
    }
    let fromFile = await this.getDropFileList(e.dataTransfer)
    while (!target.className.includes(fileItemCls)) {
      target = target.parentNode
    }
    let id = target.getAttribute('data-id')
    let type = target.getAttribute('data-type')
    if (!type) {
      return
    }
    let toFile = this.props[type + 'FileTree'][id] || {
      type,
      ...getFolderFromFilePath(this.props[type + 'Path']),
      isDirectory: false
    }
    this.onDropFile(fromFile, toFile)
  }

  onDragEnd = e => {
    removeClass(this.dom, onDragCls)
    document.querySelectorAll('.' + onDragOverCls).forEach((d) => {
      removeClass(d, onDragOverCls)
    })
    if (e && e.dataTransfer) {
      let dt = e.dataTransfer
      if (dt.items) {
        // Use DataTransferItemList interface to remove the drag data
        for (var i = 0, len = dt.items.length; i < len;i++ ) {
          dt.items.remove(i)
        }
      }
      dt.clearData()
    }
  }

  onDropFile = (fromFile, toFile) => {
    let {type: fromType} = fromFile
    let {
      type: toType,
      isDirectory: isDirectoryTo
    } = toFile

    //same side and drop to file, do nothing
    if (fromType === toType && !isDirectoryTo) {
      return
    }

    //same side and drop to folder, do mv
    if (fromType === toType && isDirectoryTo) {
      return this.mv(fromFile, toFile)
    }

    //other side, do transfer
    this.transferDrop(fromFile, toFile)

  }

  transferDrop = (fromFile, toFile) => {
    let files = this.isSelected(fromFile)
      ? this.props.selectedFiles
      : [fromFile]
    let {isDirectory, name} = toFile
    let pathFix = isDirectory ? name : ''
    return this.doTransferSelected(null, files, pathFix, fromFile.path)
  }

  mv = async (fromFile, toFile) => {
    let files = this.isSelected(fromFile)
      ? this.props.selectedFiles
      : [fromFile]
    let {type} = fromFile
    let mv = type === typeMap.local
      ? fs.mv
      : this.props.sftp.mv
    let targetPath = resolve(toFile.path, toFile.name)
    for (let f of files) {
      let {path, name} = f
      let from = resolve(path, name)
      let to = resolve(targetPath, name)
      await mv(from, to).catch(err => console.log(err))
    }
    await wait(500)
    this.props[type + 'List']()
  }

  isSelected = file => {
    return _.some(
      this.props.selectedFiles,
      f => f.id === file.id
    )
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

  editPermission = () => {
    this.props.closeContextMenu()
    this.openFileModeModal(this.state.file)
  }

  onCloseFileMode = () => {
    this.props.rootModifier({
      fileModeModalProps: {}
    })
  }

  onCloseFileInfo = () => {
    this.props.rootModifier({
      fileInfoModalProps: {}
    })
  }

  showInfo = () => {
    this.props.closeContextMenu()
    this.props.rootModifier({
      fileInfoModalProps: {
        file: this.state.file,
        tab: this.props.tab,
        visible: true,
        onClose: this.onCloseFileInfo
      }
    })
  }

  cancelNew = (type) => {
    let list = this.props[type]
    list = list.filter(p => p.id)
    this.props.modifier({
      [type]: list
    })
  }

  localCreateNew = async file => {
    let {nameTemp, isDirectory} = file
    let {localPath} = this.props
    let p = resolve(localPath, nameTemp)
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
      await wait(500)
      await this.props.remoteList()
    }
  }

  selectAll = (e) => {
    let {type} = this.props.file
    this.props.closeContextMenu()
    this.props.selectAll(type, e)
  }

  createNew = file => {
    let {type} = file
    return this[`${type}CreateNew`](file)
  }

  getShiftSelected(file, type) {
    let indexs = this.props.selectedFiles.map(
      this.props.getIndex
    )
    let i = this.props.getIndex(file)
    let lastI = this.props.getIndex(this.props.lastClickedFile)
    let arr = [...indexs, i].sort(sorter)
    let last = arr.length - 1
    let from = arr[0]
    let to = arr[last]
    let [start, end] = [from, to]
    if (indexs.includes(i)) {
      let other = lastI > i ? from : to
      ;[start, end] = [other, i].sort(sorter)
    }
    return this.props.getFileList(type).slice(start, end + 1)
  }

  onClick = e => {
    let {file} = this.state
    let {
      id,
      type
    } = file
    this.props.modifier({
      lastClickedFile: file
    })
    this.onDragEnd(e)
    if (!id) {
      return
    }
    let selectedFilesOld = copy(
      this.props.selectedFiles
    )
    let isSameSide = selectedFilesOld.length
      && type === selectedFilesOld[0].type
    let selectedFiles = [file]
    if (isSameSide) {
      if (e.ctrlKey) {
        let isSelected = _.some(
          selectedFilesOld,
          s => s.id === id
        )
        selectedFiles = isSelected
          ? selectedFilesOld.filter(s => s.id !== id)
          : [
            ...copy(selectedFilesOld),
            file
          ]
      } else if (e.shiftKey) {
        selectedFiles = this.getShiftSelected(file, type)
      }
    }
    this.props.modifier({
      selectedFiles,
      lastClickedFile: file
    })
  }

  changeFileMode = async file => {
    this.onCloseFileMode()
    let {permission, type, path, name} = file
    let func = type === typeMap.local
      ? fs.chmodAsync
      : this.props.sftp.chmod
    let p = resolve(path, name)
    await func(p, permission).catch(this.props.onError)
    this.props[type + 'List']()
  }

  openFileModeModal = () => {
    this.props.closeContextMenu()
    this.props.rootModifier({
      fileModeModalProps: {
        file: this.state.file,
        tab: this.props.tab,
        visible: true,
        onClose: this.onCloseFileMode,
        changeFileMode: this.changeFileMode
      }
    })
  }

  onBlur = () => {
    let file = copy(this.state.file)
    let {nameTemp, name, id, type} = this.state.file
    if (name === nameTemp) {
      if (!id) {
        return this.cancelNew(type)
      }
      delete file.nameTemp
      delete file.isEditting
      return this.setState({
        file
      })
    }
    if (!id) {
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

  enterDirectory = (e, file) => {
    e.stopPropagation()
    let {type, name} = file || this.state.file
    let n = `${type}Path`
    let path = this.props[n]
    let np = resolve(path, name)
    this.props.modifier({
      [n]: np,
      [n + 'Temp']: np
    }, this.props[`${type}List`])
  }

  openFile = file => {
    let filePath = resolve(file.path, file.name)
    fs.openFile(filePath)
  }

  transferOrEnterDirectory = (e) => {
    let {isDirectory, type} = this.state.file
    if (isDirectory) {
      return this.enterDirectory(e)
    }
    if (type === typeMap.local) {
      return this.openFile(this.state.file)
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

  doTransferSelected = async (
    e,
    selectedFiles = this.props.selectedFiles,
    pathFix = '',
    liveBasePath
  ) => {
    this.props.closeContextMenu()
    let filesToConfirm = []
    for (let f of selectedFiles) {
      let arr = await this.getTransferList(f)
      filesToConfirm = [
        ...filesToConfirm,
        ...arr
      ]
    }
    this.props.modifier({
      filesToConfirm,
      pathFix,
      liveBasePath
    })
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

  refresh = () => {
    this.props.closeContextMenu()
    this.props.onGoto(this.props.file.type)
  }

  del = async (delSelected) => {
    this.props.closeContextMenu()
    let {file, selectedFiles} = this.props
    let {type} = file
    let files = delSelected
      ? selectedFiles
      : [file]
    await this.props.delFiles(type, files)
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

  renderDelConfirmTitle(shouldShowSelectedMenu) {
    let {file, selectedFiles} = this.props
    let files = shouldShowSelectedMenu
      ? selectedFiles
      : [file]
    return this.props.renderDelConfirmTitle(files)
  }

  showModeEdit(type, id) {
    if (!id) {
      return false
    }
    if (type === typeMap.remote) {
      return true
    }
    return !isWin
  }

  renderContext() {
    let {
      file: {
        type,
        isDirectory,
        id
      },
      selectedFiles
    } = this.props
    let transferText = type === typeMap.local
      ? transferTypeMap.upload
      : transferTypeMap.download
    let icon = type === typeMap.local
      ? 'cloud-upload-o'
      : 'cloud-download-o'
    let len = selectedFiles.length
    let shouldShowSelectedMenu = id
      && len > 1
      && _.some(selectedFiles, d => d.id === id)
    let cls = 'pd2x pd1y context-item pointer'
    let delTxt = shouldShowSelectedMenu ? `delete all(${len})` : 'delete'
    let canPaste = hasFileInClipboardText()
    let clsPaste = canPaste
      ? cls
      : cls + ' disabled'
    return (
      <div>
        {
          isDirectory && id
            ? (
              <div
                className={cls}
                onClick={this.doEnterDirectory}
              >
                <Icon type="enter" /> enter
              </div>
            )
            : null
        }
        {
          shouldShowSelectedMenu
            ? (
              <div
                className={cls}
                onClick={this.doTransferSelected}
              >
                <Icon type={icon} /> {transferText} selected({len})
              </div>
            )
            : null
        }
        {
          !id
            ? null
            : (
              <div
                className={cls}
                onClick={this.doTransfer}
              >
                <Icon type={icon} /> {transferText}
              </div>
            )
        }
        {
          id
            ? (
              <Popconfirm
                title={this.renderDelConfirmTitle(shouldShowSelectedMenu)}
                onConfirm={() => this.del(shouldShowSelectedMenu)}
              >
                <div
                  className={cls}
                >
                  <Icon type="close-circle" /> {delTxt}
                </div>
              </Popconfirm>
            )
            : null
        }
        {
          id
            ? (
              <div
                className={cls}
                onClick={this.onCopy}
              >
                <Icon type="copy" /> copy
              </div>
            )
            : null

        }
        <div
          className={clsPaste}
          onClick={canPaste ? this.onPaste : _.noop}
        >
          <Icon type="copy" /> paste
        </div>
        {
          id
            ? (
              <div
                className={cls}
                onClick={this.doRename}
              >
                <Icon type="edit" /> rename
              </div>
            )
            : null
        }
        <div
          className={cls}
          onClick={this.newFile}
        >
          <Icon type="file-add" /> new file
        </div>
        <div
          className={cls}
          onClick={this.newDirectory}
        >
          <Icon type="folder-add" /> new directory
        </div>
        <div
          className={cls}
          onClick={this.selectAll}
        >
          <Icon type="check-square-o" /> select all
        </div>
        <div
          className={cls}
          onClick={this.refresh}
        >
          <Icon type="reload" /> refresh
        </div>
        {
          this.showModeEdit(type, id)
            ? (
              <div
                className={cls}
                onClick={this.editPermission}
              >
                <Icon type="lock" /> edit permission
              </div>
            )
            : null
        }
        {
          id
            ? (
              <div
                className={cls}
                onClick={this.showInfo}
              >
                <Icon type="info-circle-o" /> info
              </div>
            )
            : null
        }
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    let {id} = this.props.file
    let content = this.renderContext()
    let height = content.props.children.filter(_.identity)
      .length * contextMenuHeight + contextMenuPaddingTop * 2
    this.props.openContextMenu({
      content,
      pos: computePos(e, id, height)
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
    let {type, selectedFiles, draggable = true} = this.props
    let {file} = this.state
    let {
      name,
      size,
      isDirectory,
      modifyTime,
      id,
      isEditting
    } = file
    if (isEditting) {
      return this.renderEditting(file)
    }
    let selected = _.some(selectedFiles, s => s.id === id)
    let className = classnames('sftp-item', type, {
      directory: isDirectory
    }, {selected})
    let pm = type === typeMap.remote
      ? 'left'
      : 'right'
    let title = (
      <div>
        <p className="wordbreak">{name}</p>
        <p>modifyTime: {moment(modifyTime).format()}</p>
      </div>
    )
    let props = {
      className,
      draggable,
      onDoubleClick: this.transferOrEnterDirectory,
      ..._.pick(this, [
        'onContextMenu',
        'onClick',
        'onDrag',
        'onDragEnter',
        'onDragExit',
        'onDragLeave',
        'onDragOver',
        'onDragStart',
        'onDrop',
        'onDragEnd'
      ])
    }
    return (
      <div
        {...props}
        data-id={id}
        data-type={type}
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

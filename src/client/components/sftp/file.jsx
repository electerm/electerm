/**
 * file section
 */

import React from 'react'
import ReactDOM from 'react-dom'
import {Icon, Popconfirm} from 'antd'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import resolve from '../../common/resolve'
import {addClass, removeClass} from '../../common/class'
import {
  mode2permission,
  permission2mode
} from '../../common/mode2permission'
import wait from '../../common/wait'
import {
  contextMenuHeight, contextMenuPaddingTop,
  isWin, transferTypeMap, typeMap,
  contextMenuWidth, fileOpTypeMap,
  isMac, maxEditFileSize, ctrlOrCmd
} from '../../common/constants'
import findParent from '../../common/find-parent'
import sorter from '../../common/index-sorter'
import {getLocalFileInfo, getFolderFromFilePath, getRemoteFileInfo} from './file-read'
import {readClipboard, copy as copyToClipboard, hasFileInClipboardText} from '../../common/clipboard'
import fs from '../../common/fs'
import time from '../../common/time'

const {prefix} = window
const e = prefix('sftp')
const m = prefix('menu')
const c = prefix('common')

const computePos = (e, isBg, height, ) => {
  let {clientX, clientY} = e
  let res = {
    left: clientX,
    top: clientY
  }
  if (window.innerHeight < res.top + height + 10) {
    res.top = res.top - height
  }
  if (window.innerWidth < res.left + contextMenuWidth + 10) {
    res.left = res.left - contextMenuWidth
  }
  res.top = res.top > 0 ? res.top : 0
  return res
}

const fileItemCls = 'sftp-item'
const onDragCls = 'sftp-ondrag'
const onDragOverCls = 'sftp-dragover'
const onMultiDragCls = 'sftp-dragover-multi'

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
    this.applyStyle()
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      !prevState.file.id &&
      this.state.file.id
    ) {
      this.applyStyle()
    }
  }

  applyStyle = () => {
    let {
      id,
      type
    } = this.props
    let headers = document.querySelectorAll(
      `#id-${id} .${type} .sftp-file-table-header .sftp-header-box`
    )
    this.dom.querySelectorAll('.sftp-file-prop').forEach((n, i) => {
      let h = headers[i]
      if (h) {
        let s = _.pick(h.style, ['width', 'left'])
        Object.assign(n.style, s)
      }
    })
  }

  onCopy = (e, targetFiles, isCut) => {
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
    if (isCut) {
      this.props.modifier({
        transferType: fileOpTypeMap.mv
      })
    }
  }

  onCut = (e, targetFiles) => {
    this.onCopy(e, targetFiles, true)
  }

  getTransferType = fileType => {
    return fileType !== typeMap.local
      ? transferTypeMap.upload
      : transferTypeMap.download
  }

  onPaste = async () => {
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
      if (fileObj) {
        res.push(fileObj)
      }
    }
    if (!res.length) {
      return
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

    let transferType = this.getTransferType(toType)

    //same side and drop to file, do nothing
    if (fromType === toType) {
      transferType = this.props.transferType || fileOpTypeMap.copy
    }

    //other side, do transfer
    this.transferDrop(fromFile, toFile, transferType)
  }

  onDrag = () => {}

  onDragEnter = e => {
    let {target} = e
    target = findParent(target, '.' + fileItemCls)
    if (!target) {
      return e.preventDefault()
    }
    this.dropTarget = target
    target.classList.add(onDragOverCls)
  }

  onDragExit = () => {}

  onDragLeave = e => {
    let {target} = e
    target = findParent(target, '.' + fileItemCls)
    if (!target) {
      return e.preventDefault()
    }
    target.classList.remove(onDragOverCls)
  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragStart = e => {
    this.props.modifier({
      onDrag: true
    })
    let cls = this.props.selectedFiles.length > 1
      ? onDragCls + ' ' + onMultiDragCls
      : onDragCls
    addClass(this.dom, cls)
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
    let fromFileManager = !!_.get(e, 'dataTransfer.files.length')
    let {target} = e
    if (!target) {
      return
    }
    let fromFile = await this.getDropFileList(e.dataTransfer)
    if (!fromFile) {
      return
    }
    while (!target.className.includes(fileItemCls)) {
      target = target.parentNode
    }
    let id = target.getAttribute('data-id')
    let type = target.getAttribute('data-type')
    if (!type) {
      return
    }
    let toFile = this.props[type + 'FileTree'][id] || {}
    if (!toFile.id || !toFile.isDirectory) {
      toFile = {
        type,
        ...getFolderFromFilePath(this.props[type + 'Path']),
        isDirectory: false
      }
    }
    this.onDropFile(fromFile, toFile, fromFileManager)
  }

  onDragEnd = e => {
    this.props.modifier({
      onDrag: false
    })
    removeClass(this.dom, onDragCls, onMultiDragCls)
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

  onDropFile = (fromFile, toFile, fromFileManager) => {
    let {type: fromType} = fromFile
    let {
      id,
      type: toType,
      isDirectory: isDirectoryTo
    } = toFile

    let transferType = this.getTransferType(toType)

    //same side and drop to file = drop to folder
    if (!fromFileManager && fromType === toType && !isDirectoryTo) {
      return
    }

    //drop from file manager
    if (fromFileManager && toType === typeMap.local) {
      transferType = fileOpTypeMap.copy
      if (id) {
        toFile = {
          ...toFile,
          ...getFolderFromFilePath(
            resolve(toFile.path, toFile.name)
          ),
          id: undefined
        }
      }
    }

    //same side and drop to folder, do mv
    if (fromType === toType && isDirectoryTo && !fromFileManager) {
      transferType = fileOpTypeMap.mv
    }

    //other side, do transfer
    this.transferDrop(fromFile, toFile, transferType)

  }

  transferDrop = (fromFile, toFile, transferType) => {
    let files = this.isSelected(fromFile)
      ? this.props.selectedFiles
      : [fromFile]
    return this.doTransferSelected(
      null,
      files,
      fromFile.path,
      resolve(toFile.path, toFile.name),
      toFile.type,
      transferType
    )
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
    this.props.modifier({
      onEditFile: true
    })
    this.setState({
      file
    })
  }

  editPermission = () => {
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
      return this.props.modifier({
        selectedFiles: []
      })
    }
    let selectedFilesOld = copy(
      this.props.selectedFiles
    )
    let isSameSide = selectedFilesOld.length
      && type === selectedFilesOld[0].type
    let selectedFiles = [file]
    if (isSameSide) {
      if (
        (e.ctrlKey && !isMac) ||
        (e.metaKey && isMac)
      ) {
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
    let op = this.props[type + 'Path']
    this.props.modifier({
      [n]: np,
      [n + 'Temp']: np
    }, () => this.props[`${type}List`](
      undefined,
      undefined,
      op
    ))
  }

  openFile = file => {
    let filePath = resolve(file.path, file.name)
    fs.openFile(filePath)
      .catch(this.props.onError)
  }

  transferOrEnterDirectory = async (e, edit) => {
    let {file} = this.state
    let {isDirectory, type, id, size} = file
    if (isDirectory) {
      return this.enterDirectory(e)
    }
    if (!edit && type === typeMap.local) {
      return this.openFile(this.state.file)
    }
    if (
      edit ||
      (!edit && type === typeMap.remote && size < maxEditFileSize)
    ) {
      return this.props.rootModifier({
        textEditorProps: {
          visible: true,
          id,
          sftp: this.props.sftp,
          file,
          afterWrite: this.props[`${type}List`]
        }
      })
    }
    if (
      _.get(this.props, 'tab.host')
    ) {
      this.transfer()
    }
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

  getTransferProps = (
    file,
    _srcTransferPath,
    _targetTransferPath,
    _targetTransferType,
    transferType
  ) => {
    let {type} = file
    let otherType = _targetTransferType || (type === typeMap.local
      ? typeMap.remote
      : typeMap.local)
    let targetTransferPath = _targetTransferPath || this.props[otherType + 'Path']
    let srcTransferPath = _srcTransferPath || this.props[type + 'Path']
    return {
      targetTransferPath,
      transferType,
      targetTransferType: otherType,
      srcTransferType: type,
      srcTransferPath
    }
  }

  doTransferSelected = async (
    e,
    selectedFiles = this.props.selectedFiles,
    srcTransferPath,
    targetTransferPath,
    targetTransferType,
    _transferType
  ) => {
    let {type} = selectedFiles[0]
    let transferType = type === typeMap.local
      ? transferTypeMap.upload
      : transferTypeMap.download
    transferType = _transferType ? _transferType : transferType
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
      ...this.getTransferProps(
        selectedFiles[0],
        srcTransferPath,
        targetTransferPath,
        targetTransferType,
        transferType
      )
    })
  }

  transfer = async () => {
    let {file} = this.state
    let arr = await this.getTransferList(this.state.file)
    let {type} = file
    let transferType = type === typeMap.local
      ? transferTypeMap.upload
      : transferTypeMap.download
    this.props.modifier({
      filesToConfirm: arr,
      ...this.getTransferProps(file, '', '', '', transferType)
    })
  }

  doEnterDirectory = (e) => {
    this.enterDirectory(e)
  }

  refresh = () => {
    this.props.onGoto(this.props.file.type)
  }

  del = async (delSelected) => {
    let {file, selectedFiles} = this.props
    let {type} = file
    let files = delSelected
      ? selectedFiles
      : [file]
    window.postMessage({
      type: 'close-context-menu'
    }, '*')
    await this.props.delFiles(type, files)
  }

  doTransfer = () => {
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
    this.props.modifier({
      [type]: list,
      onEditFile: true
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
        size,
        id
      },
      selectedFiles,
      tab
    } = this.props
    let hasHost = !!_.get(tab, 'host')
    let transferText = type === typeMap.local
      ? e(transferTypeMap.upload)
      : e(transferTypeMap.download)
    let icon = type === typeMap.local
      ? 'cloud-upload-o'
      : 'cloud-download-o'
    let len = selectedFiles.length
    let shouldShowSelectedMenu = id
      && len > 1
      && _.some(selectedFiles, d => d.id === id)
    let cls = 'pd2x pd1y context-item pointer'
    let delTxt = shouldShowSelectedMenu ? `${e('deleteAll')}(${len})` : m('del')
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
                <Icon type="enter" /> {e('enter')}
              </div>
            )
            : null
        }
        {
          shouldShowSelectedMenu && hasHost
            ? (
              <div
                className={cls}
                onClick={this.doTransferSelected}
              >
                <Icon type={icon} /> {transferText} {e('selected')}({len})
              </div>
            )
            : null
        }
        {
          !id || !hasHost
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
          !isDirectory && id && type === typeMap.local
            ? (
              <div
                className={cls}
                onClick={this.transferOrEnterDirectory}
              >
                <Icon type="arrow-right" /> {e('open')}
              </div>
            )
            : null
        }
        {
          !isDirectory && id &&
          size < maxEditFileSize
            ? (
              <div
                className={cls}
                onClick={
                  e => this.transferOrEnterDirectory(e, true)
                }
              >
                <Icon type="edit" /> {e('edit')}
              </div>
            )
            : null
        }
        {
          id
            ? (
              <Popconfirm
                cancelText={c('cancel')}
                okText={c('ok')}
                title={this.renderDelConfirmTitle(shouldShowSelectedMenu)}
                onConfirm={() => this.del(shouldShowSelectedMenu)}
              >
                <div
                  className={cls + ' no-auto-close-context'}
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
                <Icon type="copy" /> {m('copy')}
                <span className="context-sub-text">
                  {ctrlOrCmd}+c
                </span>
              </div>
            )
            : null

        }
        {
          id
            ? (
              <div
                className={cls}
                onClick={this.onCut}
              >
                <Icon type="file-excel" /> {m('cut')}
                <span className="context-sub-text">
                  {ctrlOrCmd}+x
                </span>
              </div>
            )
            : null

        }
        <div
          className={clsPaste}
          onClick={canPaste ? this.onPaste : _.noop}
        >
          <Icon type="copy" /> {m('paste')}
          <span className="context-sub-text">
            {ctrlOrCmd}+v
          </span>
        </div>
        {
          id
            ? (
              <div
                className={cls}
                onClick={this.doRename}
              >
                <Icon type="edit" /> {e('rename')}
              </div>
            )
            : null
        }
        <div
          className={cls}
          onClick={this.newFile}
        >
          <Icon type="file-add" /> {e('newFile')}
        </div>
        <div
          className={cls}
          onClick={this.newDirectory}
        >
          <Icon type="folder-add" /> {e('newFolder')}
        </div>
        <div
          className={cls}
          onClick={this.selectAll}
        >
          <Icon type="check-square-o" /> {e('selectAll')}
          <span className="context-sub-text">
            {ctrlOrCmd}+a
          </span>
        </div>
        <div
          className={cls}
          onClick={this.refresh}
        >
          <Icon type="reload" /> {e('refresh')}
        </div>
        {
          this.showModeEdit(type, id)
            ? (
              <div
                className={cls}
                onClick={this.editPermission}
              >
                <Icon type="lock" /> {e('editPermission')}
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
                <Icon type="info-circle-o" /> {e('info')}
              </div>
            )
            : null
        }
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    let {file} = this.state
    let selected = this.isSelected(file)
    if (!selected) {
      this.onClick(e)
    }
    let {id} = file
    this.props.modifier({
      lastClickedFile: file
    })
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

  renderProp = ({name, style}) => {
    let {file} = this.state
    let value = file[name]
    let typeIcon = null
    let symbolicLinkText = null
    let {
      isDirectory,
      isSymbolicLink
    } = file
    if (isDirectory && name === 'size') {
      value = null
    }
    if (name === 'name') {
      let type = isDirectory
        ? 'folder'
        : 'file'
      typeIcon = <Icon type={type} className="mg1r" />
      symbolicLinkText = isSymbolicLink
        ? <sup className="color-blue symbolic-link-icon">*</sup>
        : null
    } else if (name === 'mode') {
      value = permission2mode(mode2permission(value))
    } else if (name.toLowerCase().includes('time')) {
      value = time(value)
    }
    return (
      <div
        key={name}
        title={value}
        className={`sftp-file-prop noise shi-${name}`}
        style={style}
      >
        {typeIcon}
        {symbolicLinkText}
        {value}
      </div>
    )
  }

  render() {
    let {type, selectedFiles, draggable = true, properties = [], onDragStart} = this.props
    let {file} = this.state
    let {
      isDirectory,
      id,
      isEditting
    } = file
    if (isEditting) {
      return this.renderEditting(file)
    }
    let selected = _.some(selectedFiles.filter(d => d), s => s.id === id)
    let className = classnames('sftp-item', type, {
      directory: isDirectory,
      selected
    })
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
        'onDrop',
        'onDragEnd'
      ]),
      onDragStart: onDragStart || this.onDragStart
    }
    return (
      <div
        {...props}
        data-id={id}
        data-type={type}
        title={file.name}
      >
        <div className="file-bg" />
        <div className="file-props">
          {
            properties.map(this.renderProp)
          }
        </div>
      </div>
    )
  }
}

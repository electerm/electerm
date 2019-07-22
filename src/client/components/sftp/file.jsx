/**
 * file section
 */

import React from 'react'
import ReactDOM from 'react-dom'
import { Icon, Popconfirm } from 'antd'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import _ from 'lodash'
import Input from '../common/input-auto-focus'
import resolve from '../../common/resolve'
import { addClass, removeClass } from '../../common/class'
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
import { getLocalFileInfo, getFolderFromFilePath, getRemoteFileInfo } from './file-read'
import { readClipboard, copy as copyToClipboard, hasFileInClipboardText } from '../../common/clipboard'
import fs from '../../common/fs'
import time from '../../common/time'

const { prefix } = window
const e = prefix('sftp')
const m = prefix('menu')
const c = prefix('common')

const computePos = (e, isBg, height) => {
  const { clientX, clientY } = e
  const res = {
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
  constructor (props) {
    super(props)
    this.state = {
      file: copy(props.file),
      overwriteStrategy: ''
    }
  }

  componentDidMount () {
    this.dom = ReactDOM.findDOMNode(this)
    this.applyStyle()
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      !prevState.file.id &&
      this.state.file.id
    ) {
      this.applyStyle()
    }
  }

  applyStyle = () => {
    const {
      id,
      type
    } = this.props
    const headers = document.querySelectorAll(
      `#id-${id} .${type} .sftp-file-table-header .sftp-header-box`
    )
    this.dom.querySelectorAll('.sftp-file-prop').forEach((n, i) => {
      const h = headers[i]
      if (h) {
        const s = _.pick(h.style, ['width', 'left'])
        Object.assign(n.style, s)
      }
    })
  }

  onCopy = (e, targetFiles, isCut) => {
    const { file } = this.state
    const selected = this.isSelected(file)
    const files = targetFiles || selected
      ? this.props.selectedFiles
      : [file]
    const prefix = file.type === typeMap.remote
      ? 'remote:'
      : ''
    const textToCopy = files.map(f => {
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
    const clickBoardText = readClipboard()
    const fileNames = clickBoardText.split('\n')
    const res = []
    for (let i = 0, len = fileNames.length; i < len; i++) {
      const item = fileNames[i]
      const isRemote = item.startsWith('remote:')
      const path = isRemote
        ? item.replace(/^remote:/, '')
        : item
      const fileObj = isRemote
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
    const { type } = this.state.file
    const toFile = {
      type,
      ...getFolderFromFilePath(this.props[type + 'Path']),
      isDirectory: false
    }
    const fromFile = res[0]
    const { type: fromType } = fromFile
    const {
      type: toType
    } = toFile

    let transferType = this.getTransferType(toType)

    // same side and drop to file, do nothing
    if (fromType === toType) {
      transferType = this.props.transferType || fileOpTypeMap.copy
    }

    // other side, do transfer
    this.transferDrop(fromFile, toFile, transferType)
  }

  onDrag = () => {}

  onDragEnter = e => {
    let { target } = e
    target = findParent(target, '.' + fileItemCls)
    if (!target) {
      return e.preventDefault()
    }
    this.dropTarget = target
    target.classList.add(onDragOverCls)
  }

  onDragExit = () => {}

  onDragLeave = e => {
    let { target } = e
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
    const cls = this.props.selectedFiles.length > 1
      ? onDragCls + ' ' + onMultiDragCls
      : onDragCls
    addClass(this.dom, cls)
    e.dataTransfer.setData('fromFile', JSON.stringify(this.props.file))
  }

  getDropFileList = async data => {
    const fromFile = data.getData('fromFile')
    if (fromFile) {
      return JSON.parse(fromFile)
    }
    const { files } = data
    const res = []
    for (let i = 0, len = files.length; i < len; i++) {
      const item = files[i]
      if (!item) {
        continue
      }
      // let file = item.getAsFile()
      const fileObj = await getLocalFileInfo(item.path)
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
    const fromFileManager = !!_.get(e, 'dataTransfer.files.length')
    let { target } = e
    if (!target) {
      return
    }
    const fromFile = await this.getDropFileList(e.dataTransfer)
    if (!fromFile) {
      return
    }
    while (!target.className.includes(fileItemCls)) {
      target = target.parentNode
    }
    const id = target.getAttribute('data-id')
    const type = target.getAttribute('data-type')
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
      const dt = e.dataTransfer
      if (dt.items) {
        // Use DataTransferItemList interface to remove the drag data
        for (var i = 0, len = dt.items.length; i < len; i++) {
          dt.items.remove(i)
        }
      }
      dt.clearData()
    }
  }

  onDropFile = (fromFile, toFile, fromFileManager) => {
    const { type: fromType } = fromFile
    const {
      id,
      type: toType,
      isDirectory: isDirectoryTo
    } = toFile

    let transferType = this.getTransferType(toType)

    // same side and drop to file = drop to folder
    if (!fromFileManager && fromType === toType && !isDirectoryTo) {
      return
    }

    // drop from file manager
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

    // same side and drop to folder, do mv
    if (fromType === toType && isDirectoryTo && !fromFileManager) {
      transferType = fileOpTypeMap.mv
    }

    // other side, do transfer
    this.transferDrop(fromFile, toFile, transferType)
  }

  transferDrop = (fromFile, toFile, transferType) => {
    const files = this.isSelected(fromFile)
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
    const file = copy(this.state.file)
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
    this.props.store.modifier({
      fileModeModalProps: {}
    })
  }

  onCloseFileInfo = () => {
    this.props.store.modifier({
      fileInfoModalProps: {}
    })
  }

  showInfo = () => {
    this.props.store.modifier({
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
    const { nameTemp, isDirectory } = file
    const { localPath } = this.props
    const p = resolve(localPath, nameTemp)
    const func = isDirectory
      ? fs.mkdirAsync
      : fs.touch
    const res = await func(p)
      .then(() => true)
      .catch(this.props.store.onError)
    if (res) {
      this.props.localList()
    }
  }

  remoteCreateNew = async file => {
    const { nameTemp, isDirectory } = file
    const { remotePath, sftp } = this.props
    const p = resolve(remotePath, nameTemp)
    const func = isDirectory
      ? sftp.mkdir
      : sftp.touch
    const res = await func(p)
      .then(() => true)
      .catch(this.props.store.onError)
    if (res) {
      await wait(500)
      await this.props.remoteList()
    }
  }

  selectAll = (e) => {
    const { type } = this.props.file
    this.props.selectAll(type, e)
  }

  createNew = file => {
    const { type } = file
    return this[`${type}CreateNew`](file)
  }

  getShiftSelected (file, type) {
    const indexs = this.props.selectedFiles.map(
      this.props.getIndex
    )
    const i = this.props.getIndex(file)
    const lastI = this.props.getIndex(this.props.lastClickedFile)
    const arr = [...indexs, i].sort(sorter)
    const last = arr.length - 1
    const from = arr[0]
    const to = arr[last]
    let [start, end] = [from, to]
    if (indexs.includes(i)) {
      const other = lastI > i ? from : to
      ;[start, end] = [other, i].sort(sorter)
    }
    return this.props.getFileList(type).slice(start, end + 1)
  }

  onClick = e => {
    const { file } = this.state
    const {
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
    const selectedFilesOld = copy(
      this.props.selectedFiles
    )
    const isSameSide = selectedFilesOld.length &&
      type === selectedFilesOld[0].type
    let selectedFiles = [file]
    if (isSameSide) {
      if (
        (e.ctrlKey && !isMac) ||
        (e.metaKey && isMac)
      ) {
        const isSelected = _.some(
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
    const { permission, type, path, name } = file
    const func = type === typeMap.local
      ? fs.chmodAsync
      : this.props.sftp.chmod
    const p = resolve(path, name)
    await func(p, permission).catch(this.props.store.onError)
    this.props[type + 'List']()
  }

  openFileModeModal = () => {
    this.props.store.modifier({
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
    const file = copy(this.state.file)
    const { nameTemp, name, id, type } = this.state.file
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
    const { type } = this.props.file
    return this[`${type}Rename`](oldname, newname)
  }

  localRename = async (oldname, newname) => {
    const { localPath } = this.props
    const p1 = resolve(localPath, oldname)
    const p2 = resolve(localPath, newname)
    await fs.renameAsync(p1, p2).catch(this.props.store.onError)
    this.props.localList()
  }

  remoteRename = async (oldname, newname) => {
    const { remotePath, sftp } = this.props
    const p1 = resolve(remotePath, oldname)
    const p2 = resolve(remotePath, newname)
    const res = await sftp.rename(p1, p2)
      .catch(this.props.store.onError)
      .then(() => true)
    if (res) {
      this.props.remoteList()
    }
  }

  onChange = e => {
    const nameTemp = e.target.value
    const file = copy(this.state.file)
    file.nameTemp = nameTemp
    this.setState({
      file
    })
  }

  enterDirectory = (e, file) => {
    e.stopPropagation()
    const { type, name } = file || this.state.file
    const n = `${type}Path`
    const path = this.props[n]
    const np = resolve(path, name)
    const op = this.props[type + 'Path']
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
    const filePath = resolve(file.path, file.name)
    fs.openFile(filePath)
      .catch(this.props.store.onError)
  }

  transferOrEnterDirectory = async (e, edit) => {
    const { file } = this.state
    const { isDirectory, type, id, size } = file
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
      return this.props.store.modifier({
        textEditorProps: {
          visible: true,
          id,
          sftpFunc: () => this.props.sftp,
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
    const { isDirectory, name, path, type } = file
    if (!isDirectory) {
      return [file]
    }
    const p = resolve(path, name)
    const files = await this.props[`${type}List`](true, p)
    let res = [file]
    for (const f of files) {
      const cs = await this.getTransferList(f)
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
    const { type } = file
    const otherType = _targetTransferType || (type === typeMap.local
      ? typeMap.remote
      : typeMap.local)
    const targetTransferPath = _targetTransferPath || this.props[otherType + 'Path']
    const srcTransferPath = _srcTransferPath || this.props[type + 'Path']
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
    const { type } = selectedFiles[0]
    let transferType = type === typeMap.local
      ? transferTypeMap.upload
      : transferTypeMap.download
    transferType = _transferType || transferType
    let filesToConfirm = []
    for (const f of selectedFiles) {
      const arr = await this.getTransferList(f)
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
    const { file } = this.state
    const arr = await this.getTransferList(this.state.file)
    const { type } = file
    const transferType = type === typeMap.local
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
    const { file, selectedFiles } = this.props
    const { type } = file
    const files = delSelected
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
    const { type } = this.state.file
    const list = this.props[type]
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

  renderDelConfirmTitle (shouldShowSelectedMenu) {
    const { file, selectedFiles } = this.props
    const files = shouldShowSelectedMenu
      ? selectedFiles
      : [file]
    return this.props.renderDelConfirmTitle(files)
  }

  showModeEdit (type, id) {
    if (!id) {
      return false
    }
    if (type === typeMap.remote) {
      return true
    }
    return !isWin
  }

  renderContext () {
    const {
      file: {
        type,
        isDirectory,
        size,
        id
      },
      selectedFiles,
      tab
    } = this.props
    const hasHost = !!_.get(tab, 'host')
    const transferText = type === typeMap.local
      ? e(transferTypeMap.upload)
      : e(transferTypeMap.download)
    const icon = type === typeMap.local
      ? 'cloud-upload-o'
      : 'cloud-download-o'
    const len = selectedFiles.length
    const shouldShowSelectedMenu = id &&
      len > 1 &&
      _.some(selectedFiles, d => d.id === id)
    const cls = 'pd2x pd1y context-item pointer'
    const delTxt = shouldShowSelectedMenu ? `${e('deleteAll')}(${len})` : m('del')
    const canPaste = hasFileInClipboardText()
    const clsPaste = canPaste
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
                <Icon type='enter' /> {e('enter')}
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
                <Icon type='arrow-right' /> {e('open')}
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
                <Icon type='edit' /> {e('edit')}
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
                  <Icon type='close-circle' /> {delTxt}
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
                <Icon type='copy' /> {m('copy')}
                <span className='context-sub-text'>
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
                <Icon type='file-excel' /> {m('cut')}
                <span className='context-sub-text'>
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
          <Icon type='copy' /> {m('paste')}
          <span className='context-sub-text'>
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
                <Icon type='edit' /> {e('rename')}
              </div>
            )
            : null
        }
        <div
          className={cls}
          onClick={this.newFile}
        >
          <Icon type='file-add' /> {e('newFile')}
        </div>
        <div
          className={cls}
          onClick={this.newDirectory}
        >
          <Icon type='folder-add' /> {e('newFolder')}
        </div>
        <div
          className={cls}
          onClick={this.selectAll}
        >
          <Icon type='check-square-o' /> {e('selectAll')}
          <span className='context-sub-text'>
            {ctrlOrCmd}+a
          </span>
        </div>
        <div
          className={cls}
          onClick={this.refresh}
        >
          <Icon type='reload' /> {e('refresh')}
        </div>
        {
          this.showModeEdit(type, id)
            ? (
              <div
                className={cls}
                onClick={this.editPermission}
              >
                <Icon type='lock' /> {e('editPermission')}
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
                <Icon type='info-circle-o' /> {e('info')}
              </div>
            )
            : null
        }
      </div>
    )
  }

  onContextMenu = e => {
    e.preventDefault()
    const { file } = this.state
    const selected = this.isSelected(file)
    if (!selected) {
      this.onClick(e)
    }
    const { id } = file
    this.props.modifier({
      lastClickedFile: file
    })
    const content = this.renderContext()
    const height = content.props.children.filter(_.identity)
      .length * contextMenuHeight + contextMenuPaddingTop * 2
    this.props.store.openContextMenu({
      content,
      pos: computePos(e, id, height)
    })
  }

  renderEditting (file) {
    const {
      nameTemp,
      isDirectory
    } = file
    const icon = isDirectory ? 'folder' : 'file'
    const pre = <Icon type={icon} />
    return (
      <div className='sftp-item'>
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

  renderProp = ({ name, style }) => {
    const { file } = this.state
    let value = file[name]
    let typeIcon = null
    let symbolicLinkText = null
    const {
      isDirectory,
      isSymbolicLink
    } = file
    if (isDirectory && name === 'size') {
      value = null
    }
    if (name === 'name') {
      const type = isDirectory
        ? 'folder'
        : 'file'
      typeIcon = <Icon type={type} className='mg1r' />
      symbolicLinkText = isSymbolicLink
        ? <sup className='color-blue symbolic-link-icon'>*</sup>
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

  render () {
    const { type, selectedFiles, draggable = true, properties = [], onDragStart } = this.props
    const { file } = this.state
    const {
      isDirectory,
      id,
      isEditting
    } = file
    if (isEditting) {
      return this.renderEditting(file)
    }
    const selected = _.some(selectedFiles.filter(d => d), s => s.id === id)
    const className = classnames('sftp-item', type, {
      directory: isDirectory,
      selected
    })
    const props = {
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
        <div className='file-bg' />
        <div className='file-props'>
          {
            properties.map(this.renderProp)
          }
        </div>
      </div>
    )
  }
}

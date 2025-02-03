/**
 * file section
 */

import React from 'react'
import ExtIcon from './file-icon'
import {
  FolderOutlined,
  FileOutlined
} from '@ant-design/icons'
import classnames from 'classnames'
import copy from 'json-deep-copy'
import { pick, some } from 'lodash-es'
import Input from '../common/input-auto-focus'
import resolve from '../../common/resolve'
import { addClass, removeClass } from '../../common/class'
import {
  mode2permission,
  permission2mode
} from '../../common/mode2permission'
import wait from '../../common/wait'
import {
  fileOperationsMap,
  isWin, transferTypeMap, typeMap,
  isMac, maxEditFileSize, ctrlOrCmd
} from '../../common/constants'
import findParent from '../../common/find-parent'
import sorter from '../../common/index-sorter'
import { getFolderFromFilePath, getLocalFileInfo, checkFolderSize } from './file-read'
import { readClipboard, copy as copyToClipboard, hasFileInClipboardText } from '../../common/clipboard'
import fs from '../../common/fs'
import time from '../../common/time'
import { filesize } from 'filesize'
import { createTransferProps } from './transfer-common'
import generate from '../../common/uid'
import { refsStatic, refs } from '../common/ref'
import iconsMap from '../sys-menu/icons-map'
import {
  Dropdown
} from 'antd'

const e = window.translate

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
    // Create ref
    this.domRef = React.createRef()
  }

  componentDidMount () {
    this.id = 'file-' + (this.props.file?.id || generate())
    refs.add(this.id, this)
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

  componentWillUnmount () {
    refsStatic.remove(this.id)
    clearTimeout(this.timer)
    this.timer = null
    this.domRef = null
    this.dropTarget = null
    this.removeFileEditEvent()
  }

  get editor () {
    return refsStatic.get('text-editor')
  }

  applyStyle = () => {
    if (!this.domRef) {
      return
    }
    const {
      id,
      type
    } = this.props
    const headers = document.querySelectorAll(
      `#id-${id} .${type} .sftp-file-table-header .sftp-header-box`
    )
    this.domRef.current?.querySelectorAll('.sftp-file-prop').forEach((n, i) => {
      const h = headers[i]
      if (h) {
        const s = pick(h.style, ['width', 'left'])
        Object.assign(n.style, s)
      }
    })
  }

  onCopy = (targetFiles, isCut) => {
    const { file } = this.state
    const selected = this.isSelected(file)
    const files = targetFiles ||
      (
        selected
          ? this.props.selectedFiles
          : [file]
      )
    const prefix = file.type === typeMap.remote
      ? 'remote:'
      : ''
    const textToCopy = files.map(f => {
      return prefix + resolve(f.path, f.name)
    }).join('\n')
    copyToClipboard(textToCopy)
    window.store.fileOperation = isCut ? fileOperationsMap.mv : fileOperationsMap.cp
  }

  onCopyPath = (targetFiles) => {
    const { file } = this.state
    const selected = this.isSelected(file)
    const files = targetFiles ||
      (
        selected
          ? this.props.selectedFiles
          : [file]
      )
    const textToCopy = files.map(f => {
      return resolve(f.path, f.name)
    }).join('\n')
    copyToClipboard(textToCopy)
  }

  onCut = (targetFiles) => {
    this.onCopy(targetFiles, true)
  }

  getTransferType = fileType => {
    return fileType !== typeMap.local
      ? transferTypeMap.upload
      : transferTypeMap.download
  }

  onPaste = async () => {
    const { type } = this.state.file
    const path = this.props[type + 'Path']
    const clickBoardText = readClipboard()
    const fileNames = clickBoardText.split('\n')
    const res = []
    const operation = this.props.fileOperation || fileOperationsMap.cp
    for (let i = 0, len = fileNames.length; i < len; i++) {
      const item = fileNames[i]
      const isRemote = item.startsWith('remote:')
      const fromPath = isRemote
        ? item.replace(/^remote:/, '')
        : item
      const { name } = getFolderFromFilePath(fromPath, isRemote)
      const toPath = resolve(path, name)
      res.push({
        typeFrom: isRemote ? typeMap.remote : typeMap.local,
        typeTo: type,
        fromPath,
        toPath,
        id: generate(),
        host: this.props.tab?.host,
        ...createTransferProps(this.props),
        operation
      })
    }
    this.props.addTransferList(res)
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
    addClass(this.domRef.current, cls)
    e.dataTransfer.setData('fromFile', JSON.stringify(this.props.file))
  }

  getDropFileList = data => {
    const fromFile = data.getData('fromFile')
    if (fromFile) {
      return [JSON.parse(fromFile)]
    }
    const { files } = data
    const res = []
    for (let i = 0, len = files.length; i < len; i++) {
      const item = files[i]
      if (!item) {
        continue
      }
      // let file = item.getAsFile()
      const isRemote = false
      const fileObj = getFolderFromFilePath(item.path, isRemote)
      res.push({
        ...fileObj,
        type: typeMap.local
      })
    }
    return res
  }

  onDrop = async e => {
    e.preventDefault()
    const fromFileManager = !!e?.dataTransfer?.files?.length
    let { target } = e
    if (!target) {
      return
    }
    const fromFiles = this.getDropFileList(e.dataTransfer)
    if (!fromFiles) {
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
    let toFile = this.props[type + 'FileTree'].get(id) || {}
    if (!toFile.id || !toFile.isDirectory) {
      toFile = {
        type,
        ...getFolderFromFilePath(this.props[type + 'Path']),
        isDirectory: false
      }
    }
    this.onDropFile(fromFiles, toFile, fromFileManager)
  }

  onDragEnd = e => {
    this.props.modifier({
      onDrag: false
    })
    removeClass(this.domRef.current, onDragCls, onMultiDragCls)
    document.querySelectorAll('.' + onDragOverCls).forEach((d) => {
      removeClass(d, onDragOverCls)
    })
    if (e && e.dataTransfer) {
      const dt = e.dataTransfer
      if (dt.items) {
        // Use DataTransferItemList interface to remove the drag data
        for (let i = 0, len = dt.items.length; i < len; i++) {
          dt.items.remove(i)
        }
      }
      dt.clearData()
    }
  }

  onDropFile = async (fromFiles, toFile, fromFileManager) => {
    const { type: fromType } = fromFiles[0]
    const {
      id,
      type: toType,
      isDirectory: isDirectoryTo
    } = toFile

    let operation = ''
    // same side and drop to file = drop to folder
    if (!fromFileManager && fromType === toType && !isDirectoryTo) {
      return
    }

    // drop from file manager
    if (fromFileManager && toType === typeMap.local) {
      operation = fileOperationsMap.cp
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
      operation = fileOperationsMap.mv
    }

    // other side, do transfer
    let files = fromFiles
    if (fromFileManager) {
      files = await this.filterFiles(fromFiles)
    }
    this.transferDrop(files, toFile, operation)
  }

  filterFiles = async (files) => {
    const res = []
    for (const file of files) {
      const { name, path } = file
      const info = await getLocalFileInfo(
        resolve(path, name)
      )
      if (info) {
        res.push(info)
      }
    }
    return res
  }

  transferDrop = (fromFiles, toFile, operation) => {
    const files = this.isSelected(fromFiles[0])
      ? this.props.selectedFiles
      : fromFiles
    return this.doTransferSelected(
      null,
      files,
      resolve(toFile.path, toFile.name),
      toFile.type,
      operation
    )
  }

  isSelected = file => {
    return some(
      this.props.selectedFiles,
      f => f.id === file.id
    )
  }

  doRename = () => {
    const file = copy(this.state.file)
    file.nameTemp = file.name
    file.isEditing = true
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

  showInfo = () => {
    const { type } = this.props
    refsStatic.get('file-modal')?.showFileInfoModal({
      file: this.state.file,
      tab: this.props.tab,
      visible: true,
      pid: this.props.pid,
      sessionId: this.props.sessionId,
      uidTree: this.props[`${type}UidTree`],
      gidTree: this.props[`${type}GidTree`]
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
      ? fs.mkdir
      : fs.touch
    const res = await func(p)
      .then(() => true)
      .catch(window.store.onError)
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
      .catch(window.store.onError)
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
      type,
      isParent
    } = file
    if (isParent) {
      return
    }
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
        const isSelected = some(
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

  changeFileMode = async (file) => {
    const { permission, type, path, name } = file
    const func = type === typeMap.local
      ? fs.chmod
      : this.props.sftp.chmod
    const p = resolve(path, name)
    await func(p, permission).catch(window.store.onError)
    this.props[type + 'List']()
  }

  openFileModeModal = () => {
    const { type } = this.props
    refsStatic.get('file-modal')?.showFileModeModal(
      {
        tab: this.props.tab,
        visible: true,
        uidTree: this.props[`${type}UidTree`],
        gidTree: this.props[`${type}GidTree`]
      },
      this.state.file,
      this.id
    )
  }

  handleBlur = () => {
    const file = copy(this.state.file)
    const { nameTemp, name, id, type } = this.state.file
    if (name === nameTemp) {
      if (!id) {
        return this.cancelNew(type)
      }
      delete file.nameTemp
      delete file.isEditing
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
    await fs.rename(p1, p2).catch(window.store.onError)
    this.props.localList()
  }

  remoteRename = async (oldname, newname) => {
    const { remotePath, sftp } = this.props
    const p1 = resolve(remotePath, oldname)
    const p2 = resolve(remotePath, newname)
    const res = await sftp.rename(p1, p2)
      .catch(window.store.onError)
      .then(() => true)
    if (res) {
      this.props.remoteList()
    }
  }

  handleChange = e => {
    const nameTemp = e.target.value
    const file = copy(this.state.file)
    file.nameTemp = nameTemp
    this.setState({
      file
    })
  }

  enterDirectory = (e, file = this.state.file) => {
    e && e.stopPropagation && e.stopPropagation()
    const { type, name, isParent } = file
    const n = `${type}Path`
    const path = isParent ? file.path : this.props[n]
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
      .catch(window.store.onError)
  }

  removeFileEditEvent = () => {
    if (this.watchingFile) {
      window.pre.ipcOffEvent('file-change', this.onFileChange)
      window.pre.runGlobalAsync('unwatchFile', this.watchingFile)
      delete this.watchingFile
    }
  }

  editWithSystemEditor = async (text) => {
    const {
      path,
      name,
      type
    } = this.state.file
    let tempPath = ''
    if (type === typeMap.local) {
      tempPath = window.pre.resolve(path, name)
    } else {
      const id = generate()
      tempPath = window.pre.resolve(
        window.pre.tempDir, `electerm-temp-${id}-${name}`
      )
      await fs.writeFile(tempPath, text)
    }
    this.watchingFile = tempPath
    this.watchFile(tempPath)
  }

  onFileChange = (e, text) => {
    this.editor.editWithSystemEditorDone({
      id: this.id,
      text
    })
  }

  watchFile = async (tempPath) => {
    window.pre.runGlobalAsync('watchFile', tempPath)
    fs.openFile(tempPath)
      .catch(window.store.onError)
    window.pre.showItemInFolder(tempPath)
    window.pre.ipcOnEvent('file-change', this.onFileChange)
  }

  gotoFolderInTerminal = () => {
    const {
      path, name
    } = this.state.file
    const rp = resolve(path, name)
    ;(
      document.querySelector('.session-current .term-sftp-tabs .type-tab.terminal') ||
      document.querySelector('.session-current .term-sftp-tabs .type-tab.ssh')
    ).click()
    this.timer = setTimeout(() => {
      window.store.runQuickCommand(
        `cd "${rp}"`
      )
    }, 500)
  }

  fetchEditorText = async (path, type) => {
    // const sftp = sftpFunc()
    const text = typeMap.remote === type
      ? await this.props.sftp.readFile(path)
      : await fs.readFile(path)
    return text
  }

  onSubmitEditFile = async (mode, type, path, text, noClose) => {
    const r = typeMap.remote === type
      ? await this.props.sftp.writeFile(
        path,
        text,
        mode
      ).catch(window.store.onError)
      : await fs.writeFile(
        path,
        text,
        mode
      ).catch(window.store.onError)
    const data = {
      loading: false
    }
    if (r && !noClose) {
      data.id = ''
      data.file = null
      data.text = ''
    }
    this.editor?.setState(data)
    if (r && !noClose) {
      this.props[`${type}List`]()
    }
  }

  editFile = () => {
    this.editor?.openEditor({
      id: this.id,
      file: this.state.file
    })
  }

  transferOrEnterDirectory = async (e, edit) => {
    const { file } = this.state
    const { isDirectory, type, size } = file
    const isLocal = type === typeMap.local
    const isRemote = type === typeMap.remote
    if (isDirectory) {
      return this.enterDirectory(e)
    }
    if (!edit && isLocal) {
      return this.openFile(this.state.file)
    }
    const remoteEdit = !edit && isRemote && size < maxEditFileSize
    if (
      edit === true || remoteEdit
    ) {
      return this.editFile()
    }
    if (
      this.props.tab?.host
    ) {
      this.transfer()
    }
  }

  getTransferList = async (
    file,
    toPathBase,
    _typeTo,
    operation
  ) => {
    const { name, path, type, isDirectory } = file
    const isLocal = type === typeMap.local
    let typeTo = isLocal
      ? typeMap.remote
      : typeMap.local
    if (_typeTo) {
      typeTo = _typeTo
    }
    let toPath = isLocal
      ? this.props[typeMap.remote + 'Path']
      : this.props[typeMap.local + 'Path']
    if (toPathBase) {
      toPath = toPathBase
    }
    toPath = resolve(toPath, name)
    const obj = {
      host: this.props.tab?.host,
      typeFrom: type,
      typeTo,
      fromPath: resolve(path, name),
      toPath,
      id: generate(),
      ...createTransferProps(this.props),
      operation
    }
    if (isDirectory) {
      const zip = await checkFolderSize(this.props, file)
      Object.assign(obj, {
        zip,
        skipExpand: zip
      })
    }
    return [obj]
  }

  doTransferSelected = async (
    e,
    selectedFiles = this.props.selectedFiles,
    toPathBase,
    typeTo,
    operation
  ) => {
    let all = []
    for (const f of selectedFiles) {
      const arr = await this.getTransferList(f, toPathBase, typeTo, operation)
      all = [
        ...all,
        ...arr
      ]
    }
    this.props.addTransferList(all)
  }

  transfer = async () => {
    const { file } = this.state
    const arr = await this.getTransferList(file)
    this.props.addTransferList(arr)
  }

  doEnterDirectory = (e) => {
    this.enterDirectory(e)
  }

  refresh = () => {
    this.props.onGoto(this.props.file.type)
  }

  shouldShowSelectedMenu = () => {
    const {
      file: {
        id
      },
      selectedFiles
    } = this.props
    return id &&
      selectedFiles.length > 1 &&
      some(selectedFiles, d => d.id === id)
  }

  del = async () => {
    const delSelected = this.shouldShowSelectedMenu()
    const { file, selectedFiles } = this.props
    const { type } = file
    const files = delSelected
      ? selectedFiles
      : [file]
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

  showInDefaultFileManager = () => {
    const { path, name } = this.state.file
    const p = resolve(path, name)
    window.pre.showItemInFolder(p)
  }

  newItem = (isDirectory) => {
    const { type } = this.state.file
    const list = copy(this.props[type])
    list.unshift({
      name: '',
      nameTemp: '',
      isDirectory,
      isEditing: true,
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
    return this.props.renderDelConfirmTitle(files, true)
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

  renderContextMenu = () => {
    return this.renderContextItems()
      .map(r => {
        const {
          func,
          text,
          disabled,
          icon,
          subText,
          requireConfirm
        } = r
        const IconCom = iconsMap[icon]
        return {
          key: func,
          label: text,
          disabled,
          icon: <IconCom />,
          extra: subText,
          danger: requireConfirm
        }
      })
  }

  renderContextItems () {
    const {
      file: {
        type,
        isDirectory,
        size,
        id,
        isParent
      },
      selectedFiles,
      tab
    } = this.props
    const isRealFile = id && !isParent
    const hasHost = !!tab.host
    const { enableSsh } = tab
    const isLocal = type === typeMap.local
    const isRemote = type === typeMap.remote
    const transferText = isLocal
      ? e(transferTypeMap.upload)
      : e(transferTypeMap.download)
    const iconType = isLocal
      ? 'CloudUploadOutlined'
      : 'CloudDownloadOutlined'
    const len = selectedFiles.length
    const shouldShowSelectedMenu = id &&
      len > 1 &&
      some(selectedFiles, d => d.id === id)
    const delTxt = shouldShowSelectedMenu ? `${e('deleteAll')}(${len})` : e('del')
    const canPaste = hasFileInClipboardText()
    const showEdit = !isDirectory && id &&
      size < maxEditFileSize
    const res = []
    if (isDirectory && isRealFile) {
      res.push({
        func: 'doEnterDirectory',
        icon: 'EnterOutlined',
        text: e('enter')
      })
    }
    if (shouldShowSelectedMenu && hasHost) {
      res.push({
        func: 'doTransferSelected',
        icon: iconType,
        text: `${e('selected')}(${len})`
      })
    }
    if (
      isDirectory && isRealFile &&
      (
        (hasHost && enableSsh !== false && isRemote) ||
        (isLocal && !hasHost)
      )
    ) {
      res.push({
        func: 'gotoFolderInTerminal',
        icon: 'CodeOutlined',
        text: e('gotoFolderInTerminal')
      })
    }
    if (!(!isRealFile || !hasHost || shouldShowSelectedMenu)) {
      res.push({
        func: 'doTransfer',
        icon: iconType,
        text: transferText
      })
    }
    if (!isDirectory && isRealFile && isLocal) {
      res.push({
        func: 'transferOrEnterDirectory',
        icon: 'ArrowRightOutlined',
        text: e('open')
      })
    }
    if (isRealFile && isLocal) {
      res.push({
        func: 'showInDefaultFileManager',
        icon: 'ContainerOutlined',
        text: e('showInDefaultFileMananger')
      })
    }
    if (showEdit) {
      res.push({
        func: 'editFile',
        icon: 'EditOutlined',
        text: e('edit')
      })
    }
    if (isRealFile) {
      res.push({
        func: 'del',
        icon: 'CloseCircleOutlined',
        text: delTxt,
        requireConfirm: true
      })
      res.push({
        func: 'onCopy',
        icon: 'CopyOutlined',
        text: e('copy'),
        subText: `${ctrlOrCmd}+c`
      })
      res.push({
        func: 'onCut',
        icon: 'FileExcelOutlined',
        text: e('cut'),
        subText: `${ctrlOrCmd}+x`
      })
    }
    res.push({
      func: 'onPaste',
      icon: 'CopyOutlined',
      text: e('paste'),
      disabled: !canPaste,
      subText: `${ctrlOrCmd}+v`
    })
    if (isRealFile) {
      res.push({
        func: 'doRename',
        icon: 'EditOutlined',
        text: e('rename')
      })
      res.push({
        func: 'onCopyPath',
        icon: 'CopyOutlined',
        text: e('copyFilePath')
      })
    }
    if (enableSsh !== false || isLocal) {
      res.push({
        func: 'newFile',
        icon: 'FileAddOutlined',
        text: e('newFile')
      })
      res.push({
        func: 'newDirectory',
        icon: 'FolderAddOutlined',
        text: e('newFolder')
      })
    }
    res.push({
      func: 'selectAll',
      icon: 'CheckSquareOutlined',
      text: e('selectAll'),
      subText: `${ctrlOrCmd}+a`
    })
    res.push({
      func: 'refresh',
      icon: 'ReloadOutlined',
      text: e('refresh')
    })
    if (this.showModeEdit(type, isRealFile)) {
      res.push({
        func: 'editPermission',
        icon: 'LockOutlined',
        text: e('editPermission')
      })
    }
    if (isRealFile) {
      res.push({
        func: 'showInfo',
        icon: 'InfoCircleOutlined',
        text: e('info')
      })
    }
    return res
  }

  onContextMenu = ({ key }) => {
    this[key]()
  }

  renderEditing (file) {
    const {
      nameTemp,
      isDirectory
    } = file
    const Icon = isDirectory ? FolderOutlined : FileOutlined
    const pre = <Icon />
    return (
      <div className='sftp-item'>
        <Input
          value={nameTemp}
          addonBefore={pre}
          onChange={this.handleChange}
          onBlur={this.handleBlur}
          onPressEnter={this.handleBlur}
        />
      </div>
    )
  }

  renderProp = ({ id, size }) => {
    const { file } = this.state
    let value = file[id]
    let typeIcon = null
    let symbolicLinkText = null
    const {
      isDirectory,
      isSymbolicLink,
      isParent
    } = file
    if (isDirectory && id === 'size') {
      value = null
    } else if (!isDirectory && id === 'size') {
      value = filesize(value)
    } else if (id === 'owner') {
      const { type } = this.props
      value = this.props[`${type}UidTree`]['' + value] || value
    } else if (id === 'group') {
      const { type } = this.props
      value = this.props[`${type}GidTree`]['' + value] || value
    }
    if (id === 'name') {
      // const Icon = isDirectory
      //   ? FolderOutlined
      //   : FileOutlined
      typeIcon = <ExtIcon file={file} className='mg1r' />
      symbolicLinkText = isSymbolicLink
        ? <sup className='color-blue symbolic-link-icon'>*</sup>
        : null
    } else if (id === 'mode') {
      value = permission2mode(mode2permission(value))
    } else if (id.toLowerCase().includes('time')) {
      value = time(value)
    }
    const divProps = {
      className: `sftp-file-prop noise shi-${id}`,
      style: {
        width: size + '%',
        flexBasis: `${size}%`
      },
      title: value
    }
    if (isParent && id !== 'name') {
      value = null
      divProps.title = ''
    } else if (isParent && id === 'name') {
      value = '..'
    }
    return (
      <div
        {...divProps}
        key={id}
      >
        {typeIcon}
        {symbolicLinkText}
        {value}
      </div>
    )
  }

  render () {
    const { type, selectedFiles, draggable = true, properties = [], onDragStart, cls = '' } = this.props
    const { file } = this.state
    const {
      isDirectory,
      id,
      isEditing,
      isParent
    } = file
    if (isEditing) {
      return this.renderEditing(file)
    }
    const selected = some(selectedFiles.filter(d => d), s => s.id === id)
    const className = classnames('sftp-item', cls, type, {
      directory: isDirectory,
      selected
    })
    const props = {
      className,
      draggable: draggable && !isParent,
      onDoubleClick: this.transferOrEnterDirectory,
      ...pick(this, [
        'onClick',
        'onDrag',
        'onDragEnter',
        'onDragExit',
        'onDragLeave',
        'onDragOver',
        'onDrop',
        'onDragEnd'
      ]),
      onDragStart: onDragStart || this.onDragStart,
      'data-id': id,
      id: this.id,
      'data-is-parent': isParent ? 'y' : 'n',
      'data-type': type,
      title: file.name
    }
    const ddProps = {
      menu: {
        items: this.renderContextMenu(),
        onClick: this.onContextMenu
      },
      trigger: ['contextMenu']
    }
    return (
      <Dropdown {...ddProps}>
        <div
          ref={this.domRef}
          {...props}
        >
          <div className='file-bg' />
          <div className='file-props-div'>
            {
              properties.map(this.renderProp)
            }
          </div>
        </div>
      </Dropdown>
    )
  }
}

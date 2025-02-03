import { Component } from 'react'
import { refs } from '../common/ref'
import generate from '../../common/uid'
import runIdle from '../../common/run-idle'
import { Spin, Modal, notification } from 'antd'
import { isEqual, last, isNumber, some, isArray, pick, uniq, debounce } from 'lodash-es'
import FileSection from './file-item'
import resolve from '../../common/resolve'
import wait from '../../common/wait'
import isAbsPath from '../../common/is-absolute-path'
import classnames from 'classnames'
import sorterIndex from '../../common/index-sorter'
import { getLocalFileInfo, getRemoteFileInfo, getFolderFromFilePath } from './file-read'
import {
  typeMap, maxSftpHistory, paneMap,
  fileTypeMap,
  terminalSerialType,
  unexpectedPacketErrorDesc,
  sftpRetryInterval
} from '../../common/constants'
import { hasFileInClipboardText } from '../../common/clipboard'
import Client from '../../common/sftp'
import fs from '../../common/fs'
import ListTable from './list-table-ui'
import deepCopy from 'json-deep-copy'
import isValidPath from '../../common/is-valid-path'
import memoizeOne from 'memoize-one'
import * as owner from './owner-list'
import AddressBar from './address-bar'
import getProxy from '../../common/get-proxy'
import './sftp.styl'

const e = window.translate

export default class Sftp extends Component {
  constructor (props) {
    super(props)
    this.state = {
      id: props.id || generate(),
      selectedFiles: [],
      lastClickedFile: null,
      onEditFile: false,
      ...this.defaultState(),
      loadingSftp: false,
      inited: false
    }
    this.retryCount = 0
  }

  componentDidMount () {
    this.id = 'sftp-' + this.props.sessionId
    this.tid = 'sftp-' + this.props.tab.id
    refs.add(this.id, this)
    refs.add(this.tid, this)
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      (
        prevProps.enableSftp !== false &&
        !prevProps.pid &&
        this.props.pid
      ) ||
      (
        prevProps.pid &&
        prevProps.enableSftp === false &&
        this.props.enableSftp !== false
      )
    ) {
      this.initData(true)
    }
    if (
      this.props.config.autoRefreshWhenSwitchToSftp &&
      prevProps.pane !== this.props.pane &&
      (this.props.pane === paneMap.fileManager || this.props.pane.sftp) &&
      this.state.inited
    ) {
      this.onGoto(typeMap.local)
      this.onGoto(typeMap.remote)
    }
    if (
      prevState.remotePath !== this.state.remotePath &&
      this.state.selectedFiles.some(f => f.type === typeMap.remote)
    ) {
      this.setState({
        selectedFiles: []
      })
    } else if (
      prevState.localPath !== this.state.localPath &&
      this.state.selectedFiles.some(f => f.type === typeMap.local)
    ) {
      this.setState({
        selectedFiles: []
      })
    }
    if (
      this.props.sftpPathFollowSsh &&
      prevProps.cwd !== this.props.cwd
    ) {
      this.updateCwd(this.props.cwd)
    }
  }

  componentWillUnmount () {
    refs.remove(this.id)
    refs.remove(this.tid)
    this.sftp && this.sftp.destroy()
    this.sftp = null
    clearTimeout(this.timer4)
    this.timer4 = null
  }

  directions = [
    'desc',
    'asc'
  ]

  defaultDirection = (i = 0) => {
    return this.directions[i]
  }

  defaultState = () => {
    const def = this.props.config.showHiddenFilesOnSftpStart
    return Object.keys(typeMap).reduce((prev, k, i) => {
      Object.assign(prev, {
        [`sortProp.${k}`]: window.store.sftpSortSetting[k].prop,
        [`sortDirection.${k}`]: window.store.sftpSortSetting[k].direction,
        [k]: [],
        [`${k}FileTree`]: {},
        [`${k}Loading`]: false,
        [`${k}InputFocus`]: false,
        [`${k}ShowHiddenFile`]: def,
        [`${k}Path`]: '',
        [`${k}PathTemp`]: '',
        [`${k}PathHistory`]: [],
        [`${k}GidTree`]: {},
        [`${k}UidTree`]: {}
      })
      return prev
    }, {})
  }

  sort = memoizeOne((
    list,
    type,
    sortDirection,
    sortProp
  ) => {
    if (!list || !list.length) {
      return []
    }

    const isDesc = sortDirection === 'desc'

    return list.slice().sort((a, b) => {
      // Handle items with no id first
      if (!a.id && b.id) return -1
      if (a.id && !b.id) return 1
      if (!a.id && !b.id) return 0

      // Sort directories before files
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }

      // Sort by the specified property
      let aValue = a[sortProp]
      let bValue = b[sortProp]

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
        return isDesc
          ? bValue.localeCompare(aValue, { sensitivity: 'base' })
          : aValue.localeCompare(bValue, { sensitivity: 'base' })
      }

      // For non-string values, use simple comparison
      if (aValue < bValue) return isDesc ? 1 : -1
      if (aValue > bValue) return isDesc ? -1 : 1
      return 0
    })
  }, isEqual)

  isActive () {
    return this.props.enableSftp && this.props.currentBatchTabId === this.props.tab.id &&
      this.props.pane === paneMap.fileManager
  }

  getCwdLocal = () => {
    if (
      !this.shouldRenderRemote() &&
      this.props.sftpPathFollowSsh &&
      this.props.cwd
    ) {
      return this.props.cwd
    }
  }

  updateCwd = (cwd) => {
    if (!this.state.inited) {
      return
    }
    const type = this.shouldRenderRemote()
      ? typeMap.remote
      : typeMap.local
    // this.setState({
    //   [`${type}PathTemp`]: cwd
    // }, () => {
    //   this.onGoto(
    //     type
    //   )
    // })
    const n = `${type}Path`
    const nt = n + 'Temp'
    this.setState({
      [n]: cwd,
      [nt]: cwd
    }, () => this[`${type}List`]())
  }

  getPwd = async (username) => {
    if (this.props.sftpPathFollowSsh && this.props.cwd) {
      return this.props.cwd
    }
    const home = await this.sftp.getHomeDir()
    if (home) {
      return home.trim()
    } else {
      return username === 'root'
        ? '/root'
        : `/home/${this.props.tab.username}`
    }
  }

  getIndex = (file) => {
    const { type } = file
    return this.getFileList(type).findIndex(f => f.id === file.id)
  }

  selectAll = (type, e) => {
    e && e.preventDefault && e.preventDefault()
    this.setState({
      selectedFiles: this.getFileList(type)
    })
  }

  selectNext = type => {
    const { selectedFiles } = this.state
    const sorted = selectedFiles.map(f => this.getIndex(f))
      .sort(sorterIndex)
    const lastOne = last(sorted)
    const list = this.getFileList(type)
    if (!list.length) {
      return
    }
    let next = 0
    if (isNumber(lastOne)) {
      next = (lastOne + 1) % list.length
    }
    const nextFile = list[next]
    if (nextFile) {
      this.setState({
        selectedFiles: [nextFile]
      })
    }
  }

  selectPrev = type => {
    const { selectedFiles } = this.state
    const sorted = selectedFiles.map(f => this.getIndex(f))
      .sort(sorterIndex)
    const lastOne = sorted[0]
    const list = this.getFileList(type)
    if (!list.length) {
      return
    }
    let next = 0
    const len = list.length
    if (isNumber(lastOne)) {
      next = (lastOne - 1 + len) % len
    }
    const nextFile = list[next]
    if (nextFile) {
      this.setState({
        selectedFiles: [nextFile]
      })
    }
  }

  localDel = async (file) => {
    const { name, isDirectory, path } = file
    const func = !isDirectory
      ? fs.unlink
      : fs.rmrf
    const p = resolve(path, name)
    await func(p).catch(window.store.onError)
  }

  remoteDel = async (file) => {
    const { name, isDirectory, path } = file
    const { sftp } = this
    const func = isDirectory
      ? sftp.rmdir
      : sftp.rm
    const p = resolve(path, name)
    await func(p).catch(window.store.onError)
  }

  confirmDelete = (files) => {
    return new Promise((resolve) => {
      Modal.confirm({
        title: this.renderDelConfirmTitle(files),
        okText: e('ok'),
        cancelText: e('cancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  }

  delFiles = async (_type, files = this.state.selectedFiles) => {
    this.onDelete = true
    const confirm = await this.confirmDelete(files)
    this.onDelete = false
    if (!confirm) {
      return
    }
    const type = files[0].type || _type
    const func = this[type + 'Del']
    for (const f of files) {
      await func(f)
    }
    if (type === typeMap.remote) {
      await wait(500)
    }
    this[type + 'List']()
  }

  renderDelConfirmTitle (files = this.state.selectedFiles, pureText) {
    const hasDirectory = some(files, f => f.isDirectory)
    const names = hasDirectory ? e('filesAndFolders') : e('files')
    if (pureText) {
      const t1 = hasDirectory
        ? e('delTip1')
        : ''
      return `${e('delTip')} ${names} ${t1} (${files.length})`
    }
    return (
      <div className='wordbreak'>
        {e('delTip')}
        {names}
        {
          hasDirectory
            ? e('delTip1')
            : ''
        }
        (<b className='mg1x'>{files.length}</b>)
      </div>
    )
  }

  enter = (type, e) => {
    const { selectedFiles, onEditFile } = this.state
    if (onEditFile || selectedFiles.length !== 1) {
      return
    }
    const file = selectedFiles[0]
    const { isDirectory } = file
    if (isDirectory) {
      this[type + 'Dom'].enterDirectory(e, file)
    } else {
      this.setState({
        filesToConfirm: [file]
      })
    }
  }

  onInputFocus = (type) => {
    this.setState({
      [type + 'InputFocus']: true
    })
    this.inputFocus = true
  }

  onInputBlur = (type) => {
    this.inputFocus = false
    this.timer4 = setTimeout(() => {
      this.setState({
        [type + 'InputFocus']: false
      })
    }, 200)
  }

  doCopy = (type, e) => {
    this[type + 'Dom'].onCopy(this.state.selectedFiles)
  }

  doCut = (type, e) => {
    this[type + 'Dom'].onCut(this.state.selectedFiles)
  }

  doPaste = (type) => {
    if (!hasFileInClipboardText()) {
      return
    }
    this[type + 'Dom'].onPaste()
  }

  initData = async () => {
    if (this.shouldRenderRemote()) {
      this.initRemoteAll()
    }
    this.initLocalAll()
  }

  shouldRenderRemote = () => {
    const { props } = this
    return props.tab?.host && props.tab?.type !== terminalSerialType
  }

  initLocalAll = () => {
    this.localListOwner()
    this.localList()
  }

  initRemoteAll = async () => {
    await this.remoteList()
    this.remoteListOwner()
  }

  modifier = (...args) => {
    runIdle(() => this.setState(...args))
  }

  addTransferList = list => {
    window.store.addTransferList(list)
  }

  computeListHeight = () => {
    const hasTransports = this.state.transports.length
    return this.props.height - 15 - (hasTransports ? 300 : 0)
  }

  onError = e => {
    window.store.onError(e)
    this.setState({
      remoteLoading: false
    })
  }

  getFileList = type => {
    const showHide = this.state[`${type}ShowHiddenFile`]
    let list = this.state[type]
    list = isArray(list) ? list : []
    if (!showHide) {
      list = list.filter(f => !/^\./.test(f.name))
    }
    return this.sort(
      list,
      type,
      this.state[`sortDirection.${type}`],
      this.state[`sortProp.${type}`]
    )
  }

  toggleShowHiddenFile = type => {
    const prop = `${type}ShowHiddenFile`
    const b = this.state[prop]
    this.setState({
      [prop]: !b
    })
  }

  buildTree = (arr, type) => {
    const parent = this.renderParentItem(type)
    const treeMap = new Map(arr.map(d => [d.id, d]))

    // Only add parent if it exists
    if (parent) {
      treeMap.set(parent.id, parent)
    }

    return treeMap
  }

  remoteListOwner = async () => {
    const remoteUidTree = await owner.remoteListUsers(
      this.props.pid,
      this.props.sessionId
    )
    const remoteGidTree = await owner.remoteListGroups(
      this.props.pid,
      this.props.sessionId
    )
    this.setState({
      remoteGidTree,
      remoteUidTree
    })
  }

  localListOwner = async () => {
    const localUidTree = await owner.localListUsers()
    const localGidTree = await owner.localListGroups()
    this.setState({
      localGidTree,
      localUidTree
    })
  }

  sftpList = (sftp, remotePath) => {
    return sftp.list(remotePath)
      .then(arr => {
        return arr.map(item => {
          const { type } = item
          return {
            ...pick(
              item,
              ['name', 'size', 'accessTime', 'modifyTime', 'mode', 'owner', 'group']
            ),
            isDirectory: type === fileTypeMap.directory,
            type: typeMap.remote,
            path: remotePath,
            isSymbol: type === fileTypeMap.link,
            id: generate()
          }
        })
      })
  }

  remoteList = async (
    returnList = false,
    remotePathReal,
    oldPath
  ) => {
    const { tab, sessionOptions, sessionId } = this.props
    const { username, startDirectory } = tab
    let remotePath
    const noPathInit = remotePathReal || this.state.remotePath
    if (noPathInit) {
      remotePath = noPathInit
    }
    if (!returnList) {
      this.setState({
        remoteLoading: true
      })
    }
    const oldRemote = deepCopy(
      this.state.remote
    )
    let sftp = this.sftp
    try {
      if (!this.sftp) {
        sftp = await Client(sessionId)
        if (!sftp) {
          return
        }
        const config = deepCopy(
          this.props.config
        )
        this.setState({
          loadingSftp: true
        })
        const opts = deepCopy({
          ...tab,
          readyTimeout: config.sshReadyTimeout,
          sessionId,
          keepaliveInterval: config.keepaliveInterval,
          proxy: getProxy(tab, config),
          ...sessionOptions
        })
        const r = await sftp.connect(opts)
          .catch(e => {
            if (
              e &&
              e.message.includes(unexpectedPacketErrorDesc) && this.retryCount
            ) {
              this.retryHandler = setTimeout(
                () => this.initData(
                  true
                ),
                sftpRetryInterval
              )
              this.retryCount++
            } else {
              throw e
            }
          })
        this.setState(() => {
          return {
            loadingSftp: false
          }
        })
        if (!r) {
          sftp.destroy()
          return this.props.editTab(tab.id, {
            sftpCreated: false
          })
        } else {
          this.sftp = sftp
        }
      }

      if (!remotePath) {
        if (startDirectory) {
          remotePath = startDirectory
        } else {
          remotePath = await this.getPwd(username)
        }
      }

      const remote = await this.sftpList(sftp, remotePath)
      this.sftp = sftp
      const update = {
        remote,
        remoteFileTree: this.buildTree(remote, typeMap.remote),
        inited: true,
        remoteLoading: false
      }
      if (!noPathInit) {
        update.remotePath = remotePath
        update.remotePathTemp = remotePath
      }
      if (returnList) {
        return remote
      } else {
        update.onEditFile = false
      }
      if (oldPath) {
        update.remotePathHistory = uniq([
          oldPath,
          ...this.state.remotePathHistory
        ]).slice(0, maxSftpHistory)
      }
      this.setState(update, () => {
        this.updateRemoteList(remote, remotePath, sftp)
        this.props.editTab(tab.id, {
          sftpCreated: true
        })
      })
    } catch (e) {
      const update = {
        remoteLoading: false,
        remote: oldRemote,
        loadingSftp: false
      }
      if (oldPath) {
        update.remotePath = oldPath
        update.remotePathTemp = oldPath
      }
      this.setState(update)
      this.onError(e)
    }
  }

  updateRemoteList = async (
    remotes,
    remotePath,
    sftp
  ) => {
    const remote = []
    for (const r of remotes) {
      const { name } = r
      if (r.isSymbol) {
        const linkPath = resolve(remotePath, name)
        let realpath = await sftp.readlink(linkPath)
          .catch(e => {
            console.debug(e)
            return null
          })
        if (!realpath) {
          continue
        }
        if (!isAbsPath(realpath)) {
          realpath = resolve(remotePath, realpath)
          realpath = await sftp.realpath(realpath)
        }
        const realFileInfo = await getRemoteFileInfo(
          sftp,
          realpath
        ).catch(e => {
          log.debug('seems a bad symbolic link')
          log.debug(e)
          return null
        })
        if (!realFileInfo) {
          continue
        }
        r.isSymbolicLink = true
        r.isDirectory = realFileInfo.isDirectory
      } else {
        r.isSymbolicLink = false
      }
      remote.push(r)
    }
    const update = {
      remote,
      remoteFileTree: this.buildTree(remote, typeMap.remote)
    }
    this.setState(update)
  }

  localList = async (returnList = false, localPathReal, oldPath) => {
    if (!fs) return
    if (!returnList) {
      this.setState({
        localLoading: true
      })
    }
    const oldLocal = deepCopy(
      this.state.local
    )
    try {
      const noPathInit = localPathReal || this.state.localPath
      const localPath = noPathInit ||
        this.getCwdLocal() ||
        this.props.tab.startDirectoryLocal ||
        window.pre.homeOrTmp
      const locals = await fs.readdirAsync(localPath)
      const local = []
      for (const name of locals) {
        const p = resolve(localPath, name)
        const fileObj = await getLocalFileInfo(p)
        if (fileObj) {
          local.push(fileObj)
        }
      }
      const update = {
        local,
        inited: true,
        localFileTree: this.buildTree(local, typeMap.local),
        localLoading: false
      }
      if (!noPathInit) {
        update.localPath = localPath
        update.localPathTemp = localPath
      }
      if (returnList) {
        return local
      } else {
        update.onEditFile = false
      }
      if (oldPath) {
        update.localPathHistory = uniq([
          oldPath,
          ...this.state.localPathHistory
        ]).slice(0, maxSftpHistory)
      }
      this.setState(update)
    } catch (e) {
      const update = {
        localLoading: false,
        local: oldLocal
      }
      if (oldPath) {
        update.localPath = oldPath
        update.localPathTemp = oldPath
      }
      this.setState(update)
      this.onError(e)
    }
  }

  remoteListDebounce = debounce(this.remoteList, 1000)

  localListDebounce = debounce(this.localList, 1000)

  timers = {}

  onChange = (e, prop) => {
    this.setState({
      [prop]: e.target.value
    })
  }

  onClickHistory = (type, path) => {
    const n = `${type}Path`
    const oldPath = this.state[type + 'Path']
    this.setState({
      [n]: path,
      [`${n}Temp`]: path
    }, () => this[`${type}List`](undefined, undefined, oldPath))
  }

  parsePath = (type, pth) => {
    const reg = /^%([^%]+)%/
    if (!reg.test(pth)) {
      return pth
    }
    const m = pth.match(reg)
    if (!m || !m[1]) {
      return pth
    }
    const envName = m[1]
    const envPath = window.pre.env[envName]
    if (envPath) {
      return pth.replace(reg, envPath)
    }
  }

  onGoto = (type, e) => {
    e && e.preventDefault()
    if (type === typeMap.remote && !this.sftp) {
      return this.initData(true)
    }
    const n = `${type}Path`
    const nt = n + 'Temp'
    const oldPath = this.state[type + 'Path']
    const np = this.parsePath(type, this.state[nt])
    if (!isValidPath(np)) {
      return notification.warning({
        message: 'path not valid'
      })
    }
    this.setState({
      [n]: np
    }, () => this[`${type}List`](undefined, undefined, oldPath))
  }

  goParent = (type) => {
    const n = `${type}Path`
    const p = this.state[n]
    const np = resolve(p, '..')
    const op = this.state[n]
    if (np !== p) {
      this.setState({
        [n]: np,
        [n + 'Temp']: np
      }, () => this[`${type}List`](
        undefined,
        undefined,
        op
      ))
    }
  }

  getFileProps = (file, type) => {
    return {
      ...this.props,
      file,
      type,
      ...pick(this, [
        'sftp',
        'modifier',
        'localList',
        'remoteList',
        'localDel',
        'remoteDel',
        'delFiles',
        'getIndex',
        'selectAll',
        'getFileList',
        'onGoto',
        'addTransferList',
        'renderDelConfirmTitle'
      ]),
      ...pick(this.state, [
        'id',
        'localPath',
        'remotePath',
        'localFileTree',
        'remoteFileTree',
        'localOrder',
        'remoteOrder',
        'sortData',
        typeMap.local,
        typeMap.remote,
        'lastClickedFile',
        'lastMataKey',
        'targetTransferType',
        'selectedFiles',
        'localGidTree',
        'remoteUidTree',
        'localUidTree',
        'remoteGidTree'
      ])
    }
  }

  renderEmptyFile = (type) => {
    const item = {
      type,
      name: '',
      isDirectory: true
    }
    return (
      <div
        className={`virtual-file virtual-file-${type}`}
      >
        <FileSection
          {...this.getFileProps(item, type)}
          ref={ref => {
            this[type + 'Dom'] = ref
          }}
          draggable={false}
          cls='virtual-file-unit'
          key={'empty' + type}
        />
      </div>
    )
  }

  renderParentItem = (type) => {
    const currentPath = this.state[`${type}Path`]
    const parentPath = resolve(currentPath, '..')
    // Don't render parent item if we're at the root
    if (parentPath === currentPath) {
      return null
    }

    const { id } = this.props.tab
    const uniqueId = `parent-${parentPath}-${id}-${type}`

    return {
      type,
      isDirectory: true,
      ...getFolderFromFilePath(parentPath, type === typeMap.remote),
      id: uniqueId,
      size: 0,
      modifyTime: 0,
      accessTime: 0,
      mode: 0,
      owner: '',
      group: '',
      isParent: true
    }
  }

  renderHistory = (type) => {
    const currentPath = this.state[type + 'Path']
    const options = this.state[type + 'PathHistory']
      .filter(o => o !== currentPath)
    const focused = this.state[type + 'InputFocus']
    if (!options.length) {
      return null
    }
    const cls = classnames(
      'sftp-history',
      'animated',
      `sftp-history-${type}`,
      { focused }
    )
    return (
      <div
        className={cls}
      >
        {
          options.map(o => {
            return (
              <div
                key={o}
                className='sftp-history-item'
                onClick={() => this.onClickHistory(type, o)}
              >
                {o}
              </div>
            )
          })
        }
      </div>
    )
  }

  renderSection (type, style, width) {
    const {
      id
    } = this.state
    const arr = this.getFileList(type)
    const loading = this.state[`${type}Loading`]
    const { host, username } = this.props.tab
    const listProps = {
      store: window.store,
      id,
      type,
      parentItem: this.renderParentItem(type),
      ...this.props,
      ...pick(
        this,
        [
          'directions',
          'renderEmptyFile',
          'getFileProps',
          'defaultDirection',
          'modifier',
          'sort'
        ]
      ),
      sortProp: this.state[`sortProp.${type}`],
      sortDirection: this.state[`sortDirection.${type}`],
      width,
      fileList: arr
    }
    const addrProps = {
      host,
      type,
      ...pick(
        this,
        [
          'onChange',
          'onGoto',
          'onInputFocus',
          'onInputBlur',
          'toggleShowHiddenFile',
          'goParent',
          'onClickHistory'
        ]
      ),
      ...pick(
        this.state,
        [
          `${type}ShowHiddenFile`,
          'onGoto',
          `${type}PathTemp`,
          `${type}Path`,
          `${type}PathHistory`,
          `${type}InputFocus`,
          'loadingSftp'
        ]
      )
    }
    return (
      <div
        className={`sftp-section sftp-${type}-section tw-${type}`}
        style={style}
        key={type}
        {...style}
      >
        <Spin spinning={loading}>
          <div className='pd1 sftp-panel'>
            {
              type === typeMap.remote
                ? (
                  <div className='pd1t pd1b pd1x alignright'>
                    {e('remote')}: {username}@{host}
                  </div>
                  )
                : (
                  <div className='pd1t pd1b pd1x'>
                    {e('local')}
                  </div>
                  )
            }
            <AddressBar
              {...addrProps}
            />
            <div
              className={`file-list ${type} relative`}
            >
              <ListTable
                {...listProps}
              />
            </div>
          </div>
        </Spin>
      </div>
    )
  }

  renderSections () {
    if (!this.isActive()) {
      return null
    }
    const arr = [
      typeMap.local,
      typeMap.remote
    ]
    const {
      height, width
    } = this.props
    const shouldRenderRemote = this.shouldRenderRemote()
    if (!shouldRenderRemote) {
      return (
        this.renderSection(arr[0], {
          width,
          left: 0,
          top: 0,
          height
        }, width)
      )
    }
    return arr.map((t, i) => {
      const style = {
        width: width / 2,
        left: i * width / 2,
        top: 0,
        height
      }
      return this.renderSection(t, style, width / 2)
    })
  }

  render () {
    const { height } = this.props
    const {
      id
    } = this.state
    const all = {
      className: 'sftp-wrap overhide relative',
      id: `id-${id}`,
      style: { height }
    }
    return (
      <div
        {...all}
      >
        {
          this.renderSections()
        }
      </div>
    )
  }
}

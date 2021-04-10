
import { Component } from 'react'
import ReactDOM from 'react-dom'
import { nanoid as generate } from 'nanoid/non-secure'
import { mergeProxy } from '../../common/merge-proxy'
import {
  ArrowUpOutlined,
  EyeInvisibleFilled,
  EyeFilled,
  ReloadOutlined,
  ArrowRightOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import runIdle from '../../common/run-idle'
import { Input, Tooltip, Spin, Modal, notification } from 'antd'
import _ from 'lodash'
import FileSection from './file-item'
import resolve from '../../common/resolve'
import wait from '../../common/wait'
import isAbsPath from '../../common/is-absolute-path'
import classnames from 'classnames'
import sorterIndex from '../../common/index-sorter'
import { getLocalFileInfo, getRemoteFileInfo } from './file-read'
import {
  typeMap, maxSftpHistory, paneMap,
  eventTypes,
  fileTypeMap,
  terminalSshConfigType, terminalSerialType,
  unexpectedPacketErrorDesc, sftpRetryInterval
} from '../../common/constants'
import { hasFileInClipboardText } from '../../common/clipboard'
import Client from '../../common/sftp'
import fs from '../../common/fs'
import ResizeWrap from '../common/resize-wrap'
import keyControlPressed from '../../common/key-control-pressed'
import keyPressed from '../../common/key-pressed'
import ListTable from './list-table-ui'
import deepCopy from 'json-deep-copy'
import isValidPath from '../../common/is-valid-path'
import memoizeOne from 'memoize-one'
import TransportEntry from './transport-entry'
import * as owner from './owner-list'
import './sftp.styl'

const { prefix } = window
const e = prefix('sftp')
const c = prefix('common')

const buildTree = arr => {
  return arr.reduce((prev, curr) => {
    return {
      ...prev,
      [curr.id]: curr
    }
  }, {})
}

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
      transferToConfirm: null,
      transferList: [],
      fileOperation: '',
      pauseAll: false
    }
    this.retryCount = 0
  }

  componentDidMount () {
    this.initData()
    this.initEvent()
  }

  componentDidUpdate (prevProps) {
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
  }

  componentWillUnmount () {
    this.destroyEvent()
    this.sftp && this.sftp.destroy()
    clearTimeout(this.timer4)
  }

  directions = [
    'desc',
    'asc'
  ]

  defaultDirection = () => {
    return this.directions[0]
  }

  defaultState = () => {
    return Object.keys(typeMap).reduce((prev, k) => {
      Object.assign(prev, {
        [`sortProp.${k}`]: 'modifyTime',
        [`sortDirection.${k}`]: this.defaultDirection(),
        [k]: [],
        [`${k}FileTree`]: {},
        [`${k}Loading`]: false,
        [`${k}InputFocus`]: false,
        [`${k}ShowHiddenFile`]: false,
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
    const l0 = _.find(list, g => !g.id)
    const l1 = list.filter(g => g.id && g.isDirectory)
    const l2 = list.filter(g => g.id && !g.isDirectory)
    const sorter = (a, b) => {
      let va = a[sortProp]
      let vb = b[sortProp]
      if (_.isString(va)) {
        va = va.toLowerCase()
        vb = vb.toLowerCase()
      }
      if (sortDirection === 'desc') {
        if (_.isString(va)) {
          return va.localeCompare(vb, { sensitivity: 'base' })
        }
        return va > vb ? -1 : 1
      } else {
        if (_.isString(va)) {
          return -va.localeCompare(vb, { sensitivity: 'base' })
        }
        return va > vb ? 1 : -1
      }
    }
    return [
      l0,
      ...l1.sort(sorter),
      ...l2.sort(sorter)
    ].filter(d => d)
  }, _.isEqual)

  initEvent () {
    const root = ReactDOM.findDOMNode(this)
    window.addEventListener('keydown', this.handleEvent)
    this.dom = root
  }

  destroyEvent () {
    window.removeEventListener('keydown', this.handleEvent)
  }

  isActive () {
    return this.props.currentTabId === this.props.tab.id &&
      this.props.pane === paneMap.fileManager
  }

  getIndex = (file) => {
    const { type } = file
    return _.findIndex(this.getFileList(type), f => f.id === file.id)
  }

  onResizeDragEnd = () => {
    window.postMessage({
      type: eventTypes.resetFileListTable,
      data: {
        id: this.state.id
      }
    }, '*')
  }

  selectAll = (type, e) => {
    e.preventDefault()
    this.setState({
      selectedFiles: this.state[type]
    })
  }

  selectNext = type => {
    const { selectedFiles } = this.state
    const sorted = selectedFiles.map(f => this.getIndex(f))
      .sort(sorterIndex)
    const last = _.last(sorted)
    const list = this.getFileList(type)
    if (!list.length) {
      return
    }
    let next = 0
    if (_.isNumber(last)) {
      next = (last + 1) % list.length
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
    const last = sorted[0]
    const list = this.getFileList(type)
    if (!list.length) {
      return
    }
    let next = 0
    const len = list.length
    if (_.isNumber(last)) {
      next = (last - 1 + len) % len
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
      ? fs.unlinkAsync
      : fs.rmrf
    const p = resolve(path, name)
    await func(p).catch(this.props.store.onError)
  }

  remoteDel = async (file) => {
    const { name, isDirectory, path } = file
    const { sftp } = this
    const func = isDirectory
      ? sftp.rmdir
      : sftp.rm
    const p = resolve(path, name)
    await func(p).catch(this.props.store.onError)
  }

  delFiles = async (_type, files = this.state.selectedFiles) => {
    this.onDelete = false
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

  renderDelConfirmTitle (files = this.state.selectedFiles) {
    const hasDirectory = _.some(files, f => f.isDirectory)
    const names = hasDirectory ? e('filesAndFolders') : e('files')
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

  onDel = (type, files) => {
    this.onDelete = true
    Modal.confirm({
      cancelText: c('cancel'),
      okText: c('ok'),
      title: this.renderDelConfirmTitle(files),
      onOk: () => this.delFiles(type, files)
    })
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
    this[type + 'Dom'].onCopy(e, this.state.selectedFiles)
  }

  doCut = (type, e) => {
    this[type + 'Dom'].onCut(e, this.state.selectedFiles)
  }

  doPaste = (type) => {
    if (!hasFileInClipboardText()) {
      return
    }
    this[type + 'Dom'].onPaste()
  }

  handleEvent = (e) => {
    if (!this.isActive() || this.state.onEditFile || this.props.store.textEditorProps.id) {
      return
    }
    const lastClickedFile = this.state.lastClickedFile || {
      type: typeMap.local
    }
    const { type } = lastClickedFile
    const { inputFocus, onDelete } = this
    if (keyControlPressed(e) && keyPressed(e, 'a') && !inputFocus) {
      e.stopPropagation()
      this.selectAll(type, e)
    } else if (keyPressed(e, 'arrowdown') && !inputFocus) {
      e.stopPropagation()
      this.selectNext(type)
    } else if (keyPressed(e, 'arrowup') && !inputFocus) {
      e.stopPropagation()
      this.selectPrev(type)
    } else if (keyPressed(e, 'delete') && !inputFocus) {
      e.stopPropagation()
      this.onDel(type)
    } else if (keyPressed(e, 'enter') && !inputFocus && !onDelete) {
      e.stopPropagation()
      this.enter(type, e)
    } else if (keyControlPressed(e) && keyPressed(e, 'c') && !inputFocus) {
      e.stopPropagation()
      this.doCopy(type, e)
    } else if (keyControlPressed(e) && keyPressed(e, 'x') && !inputFocus) {
      e.stopPropagation()
      this.doCut(type, e)
    } else if (keyControlPressed(e) && keyPressed(e, 'v') && !inputFocus) {
      e.stopPropagation()
      this.doPaste(type, e)
    } else if (keyPressed(e, 'f5')) {
      e.stopPropagation()
      this.onGoto(type)
    }
  }

  initData = async (remoteInit) => {
    if (remoteInit) {
      const { props } = this
      const host = _.get(props, 'tab.host') &&
        _.get(props, 'tab.type') !== terminalSshConfigType &&
        _.get(props, 'tab.type') !== terminalSerialType
      if (host) {
        await this.remoteList()
        this.remoteListOwner()
      }
    }
    this.localListOwner()
    this.localList()
  }

  modifier = (...args) => {
    runIdle(() => this.setState(...args))
  }

  addTransferList = list => {
    window.postMessage({
      list,
      sessionId: this.props.sessionId
    }, '*')
  }

  computeListHeight = () => {
    const hasTransports = this.state.transports.length
    return this.props.height - 15 - (hasTransports ? 300 : 0)
  }

  onError = e => {
    this.props.store.onError(e)
    this.setState({
      remoteLoading: false
    })
  }

  getFileList = type => {
    const showHide = this.state[`${type}ShowHiddenFile`]
    let list = this.state[type]
    list = _.isArray(list) ? list : []
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
        this.setState(() => {
          return {
            loadingSftp: true
          }
        })
        const r = await sftp.connect({
          ...tab,
          readyTimeout: _.get(config, 'sshReadyTimeout'),
          sessionId,
          keepaliveInterval: _.get(config, 'keepaliveInterval'),
          proxy: mergeProxy(config, tab),
          ...sessionOptions
        })
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
          return
        } else {
          this.sftp = sftp
        }
      }

      if (!remotePath) {
        if (startDirectory) {
          remotePath = startDirectory
        } else {
          let home = await sftp.getHomeDir()
            .then(r => r)
            .catch(err => {
              this.props.store.onError(err)
              return ''
            })
          if (home.includes('error:')) {
            home = '/'
          }
          if (home) {
            remotePath = home.trim()
          } else {
            remotePath = username === 'root'
              ? '/root'
              : `/home/${tab.username}`
          }
        }
      }

      let remote = await sftp.list(remotePath)
      this.sftp = sftp
      const remotes = deepCopy(remote)
      remote = []
      for (const _r of remotes) {
        const r = _r
        const { type, name } = r
        const f = {
          ..._.pick(r, ['name', 'size', 'accessTime', 'modifyTime', 'mode', 'owner', 'group']),
          isDirectory: r.type === fileTypeMap.directory,
          type: typeMap.remote,
          path: remotePath,
          id: generate()
        }
        if (type === fileTypeMap.link) {
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
          f.isSymbolicLink = true
          f.isDirectory = realFileInfo.isDirectory
        } else {
          f.isSymbolicLink = false
        }
        remote.push(f)
      }
      const update = {
        remote,
        remoteFileTree: buildTree(remote),
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
        update.remotePathHistory = _.uniq([
          oldPath,
          ...this.state.remotePathHistory
        ]).slice(0, maxSftpHistory)
      }
      this.setState(update)
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
      const localPath = noPathInit || this.props.tab.startDirectoryLocal || window.pre.homeOrtmp
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
        localFileTree: buildTree(local),
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
        update.localPathHistory = _.uniq([
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

  remoteListDebounce = _.debounce(this.remoteList, 1000)

  localListDebounce = _.debounce(this.localList, 1000)

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

  onGoto = (type, e) => {
    e && e.preventDefault()
    if (type === typeMap.remote && !this.sftp) {
      return this.initData(true)
    }
    const n = `${type}Path`
    const nt = n + 'Temp'
    const oldPath = this.state[type + 'Path']
    const np = this.state[nt]
    if (!isValidPath(np)) {
      return notification.warn({
        message: 'path not valid'
      })
    }
    this.setState({
      [n]: this.state[nt]
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
      ..._.pick(this, [
        'sftp',
        'onSort',
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
      ..._.pick(this.state, [
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
        'transferToConfirm',
        'transferList',
        'targetTransferType',
        'fileOperation',
        'selectedFiles',
        'pauseAll',
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

  renderAddonBefore = (type) => {
    const isShow = this.state[`${type}ShowHiddenFile`]
    const title = `${isShow ? e('hide') : e('show')} ${e('hfd')}`
    const Icon = isShow ? EyeFilled : EyeInvisibleFilled
    return (
      <div>
        <Tooltip
          title={title}
          placement='topLeft'
          arrowPointAtCenter
        >
          <Icon
            type='eye'
            className='mg1r'
            onClick={() => this.toggleShowHiddenFile(type)}
          />
        </Tooltip>
        <Tooltip
          title={e('goParent')}
          arrowPointAtCenter
          placement='topLeft'
        >
          <ArrowUpOutlined onClick={() => this.goParent(type)} />
        </Tooltip>
      </div>
    )
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

  renderInput (type) {
    const {
      loadingSftp
    } = this.state
    const n = `${type}PathTemp`
    const path = this.state[n]
    const realPath = this.state[`${type}Path`]
    const isLoadingRemote = type === typeMap.remote && loadingSftp
    const GoIcon = isLoadingRemote
      ? LoadingOutlined
      : (realPath === path ? ReloadOutlined : ArrowRightOutlined)
    return (
      <Input
        value={path}
        onChange={e => this.onChange(e, n)}
        onPressEnter={e => this.onGoto(type, e)}
        addonBefore={this.renderAddonBefore(type)}
        onFocus={() => this.onInputFocus(type)}
        onBlur={() => this.onInputBlur(type)}
        disabled={loadingSftp}
        addonAfter={
          <GoIcon
            onClick={isLoadingRemote ? () => null : () => this.onGoto(type)}
          />
        }
      />
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
      id,
      type,
      ...this.props,
      ..._.pick(
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
            <div className='pd1y sftp-title-wrap'>
              <div className='sftp-title'>
                {this.renderInput(type)}
                {this.renderHistory(type)}
              </div>
            </div>
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
    const arr = [
      typeMap.local,
      typeMap.remote
    ]
    const {
      height, tab, width
    } = this.props
    const shouldRenderRemote = _.get(tab, 'host') &&
      _.get(this.props, 'tab.type') !== terminalSshConfigType &&
      _.get(this.props, 'tab.enableSftp') !== false
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
    return (
      <ResizeWrap
        direction='horizontal'
        noResizeEvent
        onDragEnd={this.onResizeDragEnd}
        minWidth={300}
      >
        {
          arr.map((t, i) => {
            const style = {
              width: width / 2,
              left: i * width / 2,
              top: 0,
              height
            }
            return this.renderSection(t, style, width / 2)
          })
        }
      </ResizeWrap>
    )
  }

  render () {
    const {
      id
    } = this.state
    const { height } = this.props
    const prps = {
      localList: this.localList,
      remoteList: this.remoteList,
      sftp: this.sftp,
      sessionId: this.props.sessionId,
      store: this.props.store,
      host: this.props.tab.host,
      localListDebounce: this.localListDebounce,
      remoteListDebounce: this.remoteListDebounce,
      config: this.props.config,
      tab: this.props.tab
    }
    return (
      <div
        className='sftp-wrap overhide relative'
        id={`id-${id}`}
        style={{ height }}
      >
        {
          this.renderSections()
        }
        <TransportEntry {...prps} />
      </div>
    )
  }
}

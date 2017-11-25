
import React from 'react'
import ReactDOM from 'react-dom'
import {generate} from 'shortid'
import {Col, Row, Input, Icon, Tooltip, Spin, Modal} from  'antd'
import _ from 'lodash'
import Tranports from './transports'
import FileSection from './file'
import Confirms from './confirm-list'
import resolve from '../../common/resolve'
import wait from '../../common/wait'
import sorterIndex from '../../common/index-sorter'
import './sftp.styl'

const {getGlobal} = window
const fs = getGlobal('fs')

const sorter = (a, b) => {
  let aa = (a.isDirectory ? 0 : 1) + a.name
  let bb = (b.isDirectory ? 0 : 1) + b.name
  return bb > aa ? -1 : 1
}

const buildTree = arr => {
  return arr.reduce((prev, curr) => {
    return {
      ...prev,
      [curr.id]: curr
    }
  }, {})
}

export default class Sftp extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      id: props.id || generate(),
      local: [],
      remote: [],
      localFileTree: {},
      remoteFileTree: {},
      localLoading: false,
      remoteLoading: false,
      localShowHiddenFile: false,
      remoteShowHiddenFile: false,
      localPath: '',
      remotePath: '',
      localPathTemp: '',
      remotePathTemp: '',
      transports: [],
      selectedFiles: [],
      lastClickedFile: null,
      pathFix: '',
      filesToConfirm: []
    }
  }

  componentWillMount() {
    this.initData()
  }
  
  componentDidMount() {
    this.initEvent()
  }

  componentWillUnmount() {
    this.destroyEvent()
  }

  initEvent() {
    let root = ReactDOM.findDOMNode(this)
    window.addEventListener('keydown', this.handleEvent)
    this.dom = root
  }

  destroyEvent() {
    window.removeEventListener('keypress', this.handleEvent)
  }

  isActive() {
    return this.props.currentTabId === this.props.tab.id &&
      this.props.pane === 'sftp'
  }

  getIndex = (file) => {
    let {type} = file
    return _.findIndex(this.getFileList(type), f => f.id === file.id)
  }

  selectAll = (type, e) => {
    e.preventDefault()
    this.setState({
      selectedFiles: this.state[type]
    })
  }

  selectNext = type => {
    let {selectedFiles} = this.state
    let sorted = selectedFiles.map(f => this.getIndex(f))
      .sort(sorterIndex)
    let last = _.last(sorted)
    let list = this.getFileList(type)
    if (!list.length) {
      return
    }
    let next = 0
    if (_.isNumber(last)) {
      next = (last + 1) % list.length
    }
    let nextFile = list[next]
    if (nextFile) {
      this.setState({
        selectedFiles: [nextFile]
      })
    }
  }

  selectPrev = type => {
    let {selectedFiles} = this.state
    let sorted = selectedFiles.map(f => this.getIndex(f))
      .sort(sorterIndex)
    let last = sorted[0]
    let list = this.getFileList(type)
    if (!list.length) {
      return
    }
    let next = 0
    let len = list.length
    if (_.isNumber(last)) {
      next = (last - 1 + len) % len
    }
    let nextFile = list[next]
    if (nextFile) {
      this.setState({
        selectedFiles: [nextFile]
      })
    }
  }

  localDel = async (file) => {
    let {localPath} = this.state
    let {name, isDirectory} = file
    let fs = getGlobal('fs')
    let func = !isDirectory
      ? fs.unlinkAsync
      : fs.rmrf
    let p = resolve(localPath, name)
    await func(p).catch(this.props.onError)
  }

  remoteDel = async (file) => {
    let {remotePath} = this.state
    let {name, isDirectory} = file
    let {sftp} = this
    let func = isDirectory
      ? sftp.rmdir
      : sftp.rm
    let p = resolve(remotePath, name)
    await func(p).catch(this.props.onError)
  }

  delFiles = async (type, files = this.state.selectedFiles) => {
    let func = this[type + 'Del']
    for (let f of files) {
      await func(f)
    }
    if (type === 'remote') {
      await wait(500)
    }
    this[type + 'List']()
  }

  renderDelConfirmTitle(files = this.state.selectedFiles) {
    let hasDirectory = _.some(files, f => f.isDirectory)
    let names = hasDirectory ? 'files/folders' : 'files'
    return (
      <div className="width400 wordbreak">
        are you sure? this will delete these
        <b className="mg1x">{files.length}</b>{names}
        {
          hasDirectory
            ? 'and all the file/directory in them'
            : ''
        }
      </div>
    )
  }

  onDel = (type, files) => {
    Modal.confirm({
      title: this.renderDelConfirmTitle(files),
      onOk: () => this.delFiles(type, files)
    })
  }

  enter = (type, e) => {
    let {selectedFiles} = this.state
    if (selectedFiles.length !== 1) {
      return
    }
    let file = selectedFiles[0]
    let {isDirectory} = file
    if (isDirectory) {
      this[type + 'Dom'].enterDirectory(e, file)
    } else {
      this.setState({
        filesToConfirm: [file]
      })
    }

  }

  handleEvent = (e) => {
    if (!this.isActive()) {
      return
    }
    let lastClickedFile = this.state.lastClickedFile || {
      type: 'local'
    }
    let {type} = lastClickedFile
    if (e.ctrlKey && e.code === 'KeyA') {
      this.selectAll(type, e)
    } else if (e.code === 'ArrowDown') {
      this.selectNext(type)
    } else if (e.code === 'ArrowUp') {
      this.selectPrev(type)
    } else if (e.code === 'Delete') {
      this.onDel(type)
    } else if (e.code === 'Enter') {
      this.enter(type, e)
    }
  }

  initData = () => {
    this.remoteList()
    this.localList()
  }

  modifier = (...args) => {
    this.setState(...args)
  }

  computeListHeight = () => {
    let hasTransports = this.state.transports.length
    return this.props.height - 15 - (hasTransports ? 300 : 0)
  }

  onError = e => {
    this.props.onError(e)
    this.setState({
      remoteLoading: false
    })
  }

  getFileList = type => {
    let showHide = this.state[`${type}ShowHiddenFile`]
    if (showHide) {
      return this.state[type]
    }
    return this.state[type].filter(f => !/^\./.test(f.name))
  }

  toggleShowHiddenFile = type => {
    let prop = `${type}ShowHiddenFile`
    let b = this.state[prop]
    this.setState({
      [prop]: !b
    })
  }

  remoteList = async (returnList = false, remotePathReal) => {
    let Client = getGlobal('Ftp')
    if (!Client) return

    let sftp = this.sftp || new Client()
    let {tab} = this.props
    let {username} = tab
    let remotePath = username === 'root'
      ? '/root'
      : `/home/${tab.username}`
    let noPathInit = remotePathReal || this.state.remotePath
    if (noPathInit) {
      remotePath = noPathInit
    }
    if (!returnList) {
      this.setState({
        remoteLoading: true
      })
    }
    try {
      if (!this.sftp) {
        await sftp.connect({
          ...tab,
          readyTimeout: 50000
        })
      }
      let remote = await sftp.list(remotePath)
      this.sftp = sftp
      remote = remote.map(r => {
        return {
          ..._.pick(r, ['name', 'size', 'accessTime', 'modifyTime']),
          isDirectory: r.type === 'd',
          type: 'remote',
          path: remotePath,
          id: generate()
        }
      }).sort(sorter)
      let update = {
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
      }
      this.setState(update)
    } catch(e) {
      this.setState({
        remoteLoading: false
      })
      this.onError(e)
    }
  }

  localList = async (returnList = false, localPathReal) => {
    if (!fs) return
    if (!returnList) {
      this.setState({
        localLoading: true
      })
    }
    try {
      let noPathInit = localPathReal || this.state.localPath
      let localPath = noPathInit || getGlobal('homeOrtmp')
      let locals = await fs.readdirAsync(localPath)
      let local = []
      for(let name of locals) {
        let stat = await fs.statAsync(resolve(localPath, name))
        local.push({
          name,
          size: stat.size,
          accessTime: stat.atime,
          modifyTime: stat.mtime,
          type: 'local',
          path: localPath,
          id: generate(),
          isDirectory: stat.isDirectory()
        })
      }
      local.sort(sorter)
      let update = {
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
      }
      this.setState(update)
    } catch(e) {
      this.onError(e)
    }

  }

  timers = {}

  onChange = (e, prop) => {
    this.setState({
      [prop]: e.target.value
    })
  }

  onGoto = (type) => {
    let n = `${type}Path`
    let nt = n + 'Temp'
    this.setState({
      [n]: this.state[nt]
    }, this[`${type}List`])
  }

  goParent = (type) => {
    let n = `${type}Path`
    let p = this.state[n]
    let np = resolve(p, '..')
    if (np !== p) {
      this.setState({
        [n]: np,
        [n + 'Temp']: np
      }, this[`${type}List`])
    }
  }

  getFileProps = (file, type) => {
    return {
      ...this.props,
      file,
      type,
      rootModifier: this.props.modifier,
      ..._.pick(this, [
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
        'renderDelConfirmTitle'
      ]),
      ..._.pick(this.state, [
        'localPath',
        'remotePath',
        'localFileTree',
        'remoteFileTree',
        'local',
        'remote',
        'lastClickedFile',
        'lastMataKey',
        'selectedFiles'
      ])
    }
  }

  renderItem = (item, i, type) => {
    return (
      <FileSection
        {...this.getFileProps(item, type)}
        key={i + 'itd' + name}
      />
    )
  }

  renderEmptyFile(type) {
    let item = {
      type,
      name: '',
      isDirectory: true
    }
    return (
      <div className={`virtual-file virtual-file-${type}`}>
        <FileSection
          {...this.getFileProps(item, type)}
          ref={ref => this[type + 'Dom'] = ref}
        />
      </div>
    )
  }

  renderAddonBefore = (type) => {
    let isShow = this.state[`${type}ShowHiddenFile`]
    let title = `${isShow ? 'hide' : 'show'} hidden files and directories`
    let icon = isShow ? 'eye' : 'eye-o'
    return (
      <div>
        <Tooltip
          title="goto parent folder"
          arrowPointAtCenter
        >
          <Icon
            type="arrow-up"
            placement="topLeft"
            onClick={() => this.goParent(type)}
          />
        </Tooltip>
        <Tooltip
          title={title}
          placement="topLeft"
          arrowPointAtCenter
        >
          <Icon
            type={icon}
            className="mg1l"
            onClick={() => this.toggleShowHiddenFile(type)}
          />
        </Tooltip>
      </div>
    )
  }

  renderSection(type) {
    let n = `${type}PathTemp`
    let path = this.state[n]
    let realPath = this.state[`${type}Path`]
    let arr = this.getFileList(type)
    let loading = this.state[`${type}Loading`]
    let {host, username} = this.props.tab
    let {height} = this.props
    let goIcon = realPath === path
      ? 'reload'
      : 'arrow-right'
    return (
      <Col span={12}>
        <Spin spinning={loading}>
          <div className="pd1 sftp-panel">
            {
              type === 'remote'
                ? (
                  <div className="pd2t pd1b pd1x alignright">
                    remote: {username}@{host}
                  </div>
                )
                : (
                  <div className="pd2t pd1b pd1x">
                    local
                  </div>
                )
            }
            <div className="pd1y sftp-title-wrap">
              <div className="sftp-title">
                <Input
                  value={path}
                  onChange={e => this.onChange(e, n)}
                  onPressEnter={() => this.onGoto(type)}
                  addonBefore={this.renderAddonBefore(type)}
                  addonAfter={
                    <Icon
                      type={goIcon}
                      onClick={() => this.onGoto(type)}
                    />
                  }
                />
              </div>
            </div>
            <div
              className="file-list pd1 overscroll-y relative"
              style={{height: height - 15}}
            >
              {this.renderEmptyFile(type)}
              {
                arr.map((item, i) => {
                  return this.renderItem(item, i, type)
                })
              }
            </div>
          </div>
        </Spin>
      </Col>
    )
  }

  render() {
    let {
      id,
      transports,
      filesToConfirm,
      remotePath,
      localPath,
      pathFix
    } = this.state
    let {height, onError} = this.props
    let props = {
      transports,
      onError,
      localPath,
      pathFix,
      remotePath,
      ..._.pick(this, [
        'sftp',
        'modifier',
        'localList',
        'remoteList',
        'remotePath',
        'localPath'
      ])
    }
    return (
      <div className="sftp-wrap overhide relative" id={id} style={{height}}>
        <Row>
          {this.renderSection('local')}
          {this.renderSection('remote')}
        </Row>
        <Tranports
          {...props}
        />
        <Confirms
          files={filesToConfirm}
          {...props}
        />
      </div>
    )
  }

}

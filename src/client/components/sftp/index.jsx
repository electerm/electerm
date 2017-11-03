
import React from 'react'
import {generate} from 'shortid'
import {Col, Row, Input, Icon, Tooltip, Spin} from  'antd'
import _ from 'lodash'
import Tranports from './transports'
import copy from 'json-deep-copy'
import FileSection from './file'
import resolve from '../../common/resolve'
import './sftp.styl'

const {getGlobal} = window
const fs = getGlobal('fs')
const sorter = (a, b) => {
  let aa = (a.isDirectory ? 0 : 1) + a.name
  let bb = (b.isDirectory ? 0 : 1) + b.name
  return bb > aa ? -1 : 1
}

export default class Sftp extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      id: props.id || generate(),
      local: [],
      remote: [],
      localLoading: false,
      remoteLoading: false,
      localShowHiddenFile: false,
      remoteShowHiddenFile: false,
      localPath: '',
      remotePath: '',
      localPathTemp: '',
      remotePathTemp: '',
      transports: []
    }
  }

  componentWillMount() {
    this.initData()
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

  remoteList = async () => {
    let Client = getGlobal('Ftp')
    if (!Client) return

    let sftp = new Client()
    let {tab} = this.props
    let {username} = tab
    let remotePath = username === 'root'
      ? '/root'
      : `/home/${tab.username}`
    let noPathInit = this.state.remotePath
    if (noPathInit) {
      remotePath = noPathInit
    }
    this.setState({
      remoteLoading: true
    })
    try {
      await sftp.connect({
        ...tab,
        readyTimeout: 50000
      })
      let remote = await sftp.list(remotePath)
      this.sftp = sftp
      remote = remote.map(r => {
        return {
          ..._.pick(r, ['name', 'size', 'accessTime', 'modifyTime']),
          isDirectory: r.type === 'd',
          type: 'remote'
        }
      }).sort(sorter)
      let update = {
        remote,
        remoteLoading: false
      }
      if (!noPathInit) {
        update.remotePath = remotePath
        update.remotePathTemp = remotePath
      }
      this.setState(update)
    } catch(e) {
      this.onError(e)
    }
  }

  localList = async () => {
    if (!fs) return
    this.setState({
      localLoading: true
    })
    try {
      let noPathInit = this.state.localPath
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
          isDirectory: stat.isDirectory()
        })
      }
      local.sort(sorter)
      let update = {
        local,
        localLoading: false
      }
      if (!noPathInit) {
        update.localPath = localPath
        update.localPathTemp = localPath
      }
      this.setState(update)
    } catch(e) {
      this.onError(e)
    }

  }

  timers = {}

  transferOrEnterDirectory = (item, e) => {
    if (item.isDirectory) {
      e.stopPropagation()
      let {type, name} = item
      let n = `${type}Path`
      let path = this.state[n]
      let np = resolve(path, name)
      this.setState({
        [n]: np,
        [n + 'Temp']: np
      }, this[`${type}List`])
    } else {
      this.transfer(item, e)
    }
  }

  onChange = (e, prop) => {
    this.setState({
      [prop]: e.target.value
    })
  }

  addTransport = t => {
    let transports = copy(this.state.transports)
    if (
      _.some(transports, x => {
        return x.localPath === t.localPath &&
          x.remotePath === t.remotePath
      })
    ) {
      return
    }
    transports.push(t)
    this.setState({
      transports
    })
  }

  transfer = async (file) => {
    let {type, name} = file
    let rPAth = this.state.remotePath
    let lPath = this.state.localPath
    let fr = resolve(rPAth, name)
    let fl = resolve(lPath, name)
    this.addTransport({
      localPath: fl,
      remotePath: fr,
      id: fl + ':' +  fr,
      percent: 0,
      file,
      type: type === 'remote' ? 'download' : 'upload'
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
      ..._.pick(this, [
        'transfer',
        'sftp',
        'modifier',
        'localList',
        'remoteList',
        'onGoto',
        'transferOrEnterDirectory'
      ]),
      ..._.pick(this.state, [
        'localPath',
        'remotePath',
        'local',
        'remote'
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
    let {id, transports} = this.state
    let {height, onError} = this.props
    let props = {
      transports,
      onError,
      ..._.pick(this, [
        'sftp',
        'modifier',
        'localList',
        'remoteList'
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
      </div>
    )
  }

}

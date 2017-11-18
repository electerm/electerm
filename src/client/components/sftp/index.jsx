
import React from 'react'
import {generate} from 'shortid'
import {Col, Row, Input, Icon, Tooltip, Spin} from  'antd'
import _ from 'lodash'
import Tranports from './transports'
import FileSection from './file'
import Confirms from './confirm-list'
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
      transports: [],
      selectedFiles: [],
      lastClickedFile: null,
      lastMataKey: null,
      filesToConfirm: []
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
        'onGoto'
      ]),
      ..._.pick(this.state, [
        'localPath',
        'remotePath',
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
      localPath
    } = this.state
    let {height, onError} = this.props
    let props = {
      transports,
      onError,
      localPath,
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

/**
 * file/directory wait to be confirmed
 */

import React from 'react'
import {Modal, Icon, Button} from 'antd'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {generate} from 'shortid'
import Trigger from './file-transfer-trigger'
import resolve from '../../common/resolve'

const {getGlobal} = window

export default class Confirms extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      currentFile: props.files[0] || null,
      files: props.files || [],
      index: 0,
      transferList: [],
      transferTree: {}
    }
  }

  componentWillMount() {
    this.rebuildState()
  }

  componentWillReceiveProps(nextProps) {
    debug(nextProps.files, 'nextProps.files')
    if (
      !_.isEqual(this.props.files, nextProps.files)
    ) {
      this.rebuildState(nextProps)
    }
  }

  setStateProxy = (data, cb) => {
    if (data.transferList) {
      let tree = data.transferList.reduce((prev, t) => {
        let {localPath, remotePath, type} = t
        let startPath = type === 'local'
          ? localPath
          : remotePath
        let targetPath = type === 'local'
          ? remotePath
          : localPath
        prev[startPath] = targetPath
        return prev
      }, {})
      data.transferTree = tree
    }
    this.setState(data, cb)
  }

  setStateAsync = (props) => {
    return new Promise((resolve) => {
      this.setStateProxy(props, resolve)
    })
  }

  submit = () => {
    let {transports} = this.props
    this.props.modifier({
      filesToConfirm: [],
      transports: [
        ...transports,
        ...this.state.transferList
      ]
    })
  }

  skip = async () => {
    let update = await this.getNextIndex(this.state.index)
    this.setStateProxy(update)
  }

  cancel = () => {
    this.props.modifier({
      filesToConfirm: []
    })
  }

  getNewName = (path) => {
    let {renameFunctions} = this.state
    return renameFunctions.reduce((prev, curr) => {
      return curr[prev]
    }, path)
  }

  buildNewName = (name, isDirectory) => {
    if (isDirectory) {
      return name + '__renamed__' + generate()
    }
    return 'renamed__' + generate() + '__' + name
  }

  localCheckExist = async (path) => {
    let fs = getGlobal('fs')
    return await fs.accessAsync(path)
      .then(() => true)
      .catch(() => false)
  }

  remoteCheckExist = async (path) => {
    let {sftp} = this.props
    let res = await sftp.lstat(path)
      .then(() => true)
      .catch(() => false)
    return res
  }

  checkExist = async (type, path) => {
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    return await this[otherType + 'CheckExist'](path)
  }

  checkFileExist = async (file) => {
    let {
      type,
      path,
      name
    } = file
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    let basePath = this.props[type + 'Path']
    let beforePath = resolve(path, name)
    let reg = new RegExp('^' + basePath)
    let otherPath = this.props[otherType + 'Path']
    let targetPath = beforePath.replace(reg, otherPath)
    return await this.checkExist(type, targetPath)
  }

  buildTransfer = ({file, localPath, remotePath}) => {
    let {type} = file
    return {
      localPath,
      remotePath,
      id: generate(),
      percent: 0,
      file,
      type: type === 'remote' ? 'download' : 'upload'
    }
  }

  createTransfer = (file, targetPath) => {
    let {name, path, type} = file
    let startPath = resolve(path, name)
    let targetPath0 = targetPath || this.getTargetPath(file)
    let isLocal = type === 'local'
    return this.buildTransfer({
      file,
      localPath: isLocal ? startPath : targetPath0,
      remotePath: isLocal ? targetPath0 : startPath
    })
  }

  findParentTransport = (file) => {
    let path = _.get(file, 'path') || ''
    let {transferList} = this.state
    let len = transferList.length
    for(let i = len - 1;i >= 0;i --) {
      let t = transferList[i]
      if (path.startsWith(t.file.path)) {
        return t
      }
    }
    return null
  }

  getNextIndex = async (currentIndex = this.state.index) => {
    let index = currentIndex + 1
    let currentFile = this.state.files[index] || null
    if (!currentFile) {
      return {index, currentFile}
    }
    let {
      type,
      path
    } = currentFile
    let transferList = copy(this.state.transferList)
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    let transport = this.findParentTransport(currentFile)
    let targetPath
    if (transport) {
      let rest = path.replace(transport.file.path, '')
      targetPath = transport[otherType + 'Path'] + rest
    } else {
      targetPath = this.getTargetPath(currentFile)
    }
    let exist = await this.checkExist(type, targetPath)
    if (exist) {
      return {index, currentFile}
    }
    let t = this.createTransfer(currentFile, targetPath)
    transferList.push(t)
    await this.setStateAsync({transferList, index})
    return await this.getNextIndex(index)
  }

  getTargetPath = (file, shouldRename = false) => {
    let {
      name,
      path,
      type,
      isDirectory
    } = file
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    let basePath = this.props[type + 'Path']
    let otherBasePath = this.props[otherType + 'Path']
    let regBase = new RegExp('^' + basePath)
    let targetPath = path.replace(regBase, otherBasePath)
    let newName = shouldRename
      ? this.buildNewName(name, isDirectory)
      : name
    return resolve(targetPath, newName)
  }

  rename = async (
    e,
    file = this.state.currentFile,
    index = this.state.index,
    shouldReturn
  ) => {
    let {
      name,
      type,
      isDirectory,
      path: bp
    } = file
    let {files} = this.state
    let newName = this.buildNewName(name, isDirectory)
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    let basePath = this.props[type + 'Path']
    let targetPath = this.props[otherType + 'Path']
    let beforePath = resolve(bp, name)
    let newPath = resolve(bp, newName)
    let reg = new RegExp('^' + basePath)
    let reg1 = new RegExp('^' + beforePath)
    let i = index + 0
    let transferList = copy(this.state.transferList)
    for (;;i ++) {
      let f = files[i] || {}
      let {path, name, type} = f
      if (!path || !path.startsWith(bp)) {
        break
      }
      let p = resolve(path, name)
      let np = p.replace(reg1, newPath)
      let t = np.replace(reg, targetPath)
      let isLocal = type === 'local'
      transferList.push({
        localPath: isLocal ? p : t,
        remotePath: isLocal ? t : p,
        id: generate(),
        percent: 0,
        file: f,
        type: type === 'remote' ? 'download' : 'upload'
      })
    }
    await this.setStateAsync({
      transferList,
      index: i
    })
    let update = await this.getNextIndex(i)
    if (shouldReturn) {
      return update
    }
    this.setStateProxy(update)
  }

  renameAll = async () => {
    let currentFile, index
    let up = await this.rename(
      undefined,
      undefined,
      undefined,
      true
    )
    currentFile = up.currentFile
    index = up.index
    let {files} = this.state
    let {length} = files
    while(index < length) {
      let obj = await this.rename(
        undefined,
        currentFile, index, true
      )
      currentFile = obj.currentFile
      index = obj.index
    }
    await this.setStateAsync({
      currentFile, index
    })
  }

  mergeOrOverwrite = async () => {
    let {currentFile} = this.state
    let {isDirectory} = currentFile
    let transferList = copy(this.state.transferList)
    let exist = await this.checkFileExist(currentFile)
    if (!exist || !isDirectory) {
      transferList.push(this.createTransfer(currentFile))
    }
    await this.setStateAsync({
      transferList
    })
    let update = await this.getNextIndex()
    await this.setStateAsync(update)
  }

  mergeOrOverwriteAll = async () => {
    let {files, index} = this.state
    let i = index
    let transferList = copy(this.state.transferList)
    let len = files.length
    for(;i < len;i ++) {
      let f = files[i]
      let {isDirectory} = f
      let exist = await this.checkFileExist(f)
      if (!exist || !isDirectory) {
        transferList.push(this.createTransfer(f))
      }
    }
    this.setStateProxy({
      currentFile: null,
      index: files.length + 1,
      transferList
    })
  }

  onVisibleChange = showList => {
    this.setStateProxy({
      showList
    })
  }

  rebuildState = async (nextProps = this.props) => {
    let {files} = nextProps
    debug(files, 'files in rebuildState')
    let firstFile = files[0] || null
    if (!firstFile) {
      return this.setStateProxy({
        currentFile: null
      })
    }
    let exist = await this.checkFileExist(firstFile)
    if (exist) {
      return this.setStateProxy({
        currentFile: firstFile,
        files,
        index: 0,
        transferList: []
      })
    }

    await this.setStateAsync({
      transferList: [this.createTransfer(firstFile)],
      files
    })

    let update = await this.getNextIndex(0)

    this.setStateProxy(update)
  }

  renderFooter() {
    let {currentFile} = this.state
    if (!currentFile) {
      return null
    }
    let {isDirectory} = currentFile
    return (
      <div className="bordert mgq1t pd1y alignright">
        <Button
          type="ghost"
          className="mg1l"
          onClick={this.cancel}
        >
          cancel
        </Button>
        <Button
          type="ghost"
          className="mg1l"
          onClick={this.skip}
        >
          skip
        </Button>
        <Button
          type="primary"
          className="mg1l"
          onClick={
            this.overwriteOrOverwrite
          }
        >
          {isDirectory ? 'merge' : 'overwrite'}
        </Button>
        <Button
          type="primary"
          className="mg1l"
          onClick={
            this.rename
          }
        >
          rename
        </Button>
        <div className="pd1t" />
        <Button
          type="ghost"
          className="mg1l"
          title={
            isDirectory
              ? 'merge rest conflict folders'
              : 'overwrite rest conflict files'
          }
          onClick={
            this.mergeOrOverwriteAll
          }
        >
          {isDirectory ? 'merge all' : 'overwrite all'}
        </Button>
        <Button
          type="primary"
          className="mg1l"
          title="rename rest files/folders"
          onClick={
            this.renameAll
          }
        >
          rename all
        </Button>
      </div>
    )
  }

  renderContent = () => {
    let {currentFile} = this.state
    if (!currentFile) {
      return null
    }
    let {
      type,
      isDirectory,
      name,
      path,
      targetPath
    } = currentFile
    let from = resolve(path, name)
    let action = isDirectory ? 'merge' : 'replace'
    let typeTxt = isDirectory ? 'folder' : 'file'
    let typeTitle = type === 'local' ? 'remote' : 'local'
    return (
      <div className="confirms-content-wrap">
        <Icon type={typeTxt} className="confirm-icon-bg" />
        <div className="confirms-content">
          <p>
            {action}
          </p>
          <p className="bold">
            {typeTitle} {typeTxt}: {name} ({targetPath})
          </p>
          <p>
            with
          </p>
          <p className="bold">
            {from}
          </p>
        </div>
      </div>
    )
  }

  render() {
    let {currentFile, index, files} = this.state
    let props = {
      visible: !!currentFile,
      width: 500,
      title: 'file conflict',
      footer: this.renderFooter(),
      onCancel: this.onCancel
    }
    let triggerProps = {
      submit: this.submit,
      index,
      files
    }
    return (
      <div>
        <Modal
          {...props}
        >
          {this.renderContent()}
        </Modal>
        <Trigger
          {...triggerProps}
        />
      </div>
    )
  }
}

/**
 * file/directory wait to be confirmed
 */

import React from 'react'
import {Modal, Icon, Button} from 'antd'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {generate} from 'shortid'

const {getGlobal} = window
let resolve = getGlobal('resolve')

export default class Confirms extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      currentFile: props.files[0] || null,
      files: [],
      index: 0,
      transferList: []
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      !_.isEqual(this.props.files, nextProps.files)
    ) {
      this.rebuildState(nextProps)
    }
  }

  setStateAsync = (props) => {
    return new Promise((resolve) => {
      this.setState(props, resolve)
    })
  }

  submit = () => {

  }

  skip = async () => {
    let update = await this.getNextIndex(this.state.index)
    this.setState(update)
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
    return await sftp.lstat(path)
      .then(() => true)
      .catch(() => false)
  }

  checkExist = async (type, path) => {
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    return await this[otherType + 'CheckExist'](path)
  }

  checkFileExist = async file => {
    let {
      type,
      path
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

  getNextIndex = async (currentIndex) => {
    let index = currentIndex + 1
    let currentFile = this.state.files[index] || null
    if (!currentFile) {
      return {index, currentFile}
    }
    let {
      type,
      path
    } = currentFile
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    let basePath = this.props[type + 'Path']
    let beforePath = resolve(path, name)
    let reg = new RegExp('^' + basePath)
    let otherPath = this.props[otherType + 'Path']
    let targetPath = beforePath.replace(reg, otherPath)
    let exist = await this.checkExist(type, targetPath)
    if (exist) {
      return {index, currentFile}
    } else {
      let i = currentIndex + 1
      let {files} = this.state
      for (;;) {
        let f = files[i]
        let {path} = f
        if (path.startWith(beforePath)) {
          i++
        } else {
          break
        }
      }
      return this.getNextIndex(i)
    }
  }

  rename = async () => {
    let {
      name,
      type,
      isDirectory,
      path
    } = this.state.currentFile
    let {index, files} = this.state
    let newName = this.buildNewName(name, isDirectory)
    let otherType = type === 'local'
      ? 'remote'
      : 'local'
    let basePath = this.props[type + 'Path']
    let targetPath = this.props[otherType + 'Path']
    let beforePath = resolve(path, name)
    let newPath = resolve(path, newName)
    let reg = new RegExp('^' + basePath)
    let reg1 = new RegExp('^' + beforePath)
    let i = index + 0
    let transferList = copy(this.state.transferList)
    for (;;i ++) {
      let f = files[i]
      let {path, name, type} = f
      if (!path.startWith(path)) {
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

    let update = await this.getNextIndex(i)
    this.setState({
      ...update,
      transferList
    })
    /*
    {
      localPath: fl,
      remotePath: fr,
      id: generate(),
      percent: 0,
      file,
      type: type === 'remote' ? 'download' : 'upload'
    }
    */

  }

  renameAll = () => {

  }

  mergeOrOverwrite = () => {

  }

  mergeOrOverwriteAll = () => {

  }

  onVisibleChange = showList => {
    this.setState({
      showList
    })
  }

  rebuildState = async nextProps => {
    let {files} = nextProps
    let firstFile = files[0] || null
    if (!firstFile) {
      return this.setState({
        currentFile: null
      })
    }
    let exist = await this.checkFileExist(firstFile)
    if (exist) {
      return this.setState({
        currentFile: firstFile,
        files,
        index: 0,
        transferList: []
      })
    }

    await this.setStateAsync({
      transferList: []
    })

    let update = this.getNextIndex(0)

    this.setState({
      ...update,
      files
    })
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
      path
    } = currentFile
    return (
      <div className="confirms-content">
        <Icon type="info-circle-o" className="confirm-icon-bg" />
      </div>
    )
  }

  render() {
    let {currentFile} = this.state
    let props = {
      visible: !!currentFile,
      width: 500,
      title: 'file conflict',
      footer: this.renderFooter()
    }
    return (
      <Modal
        {...props}
      >
        {this.renderContent()}
      </Modal>
    )
  }
}

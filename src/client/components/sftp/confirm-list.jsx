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
import AnimateText from '../common/animate-text'
import fs from '../../common/fs'
import {typeMap} from '../../common/constants'

const {prefix} = window
const e = prefix('sftp')

export default class Confirms extends React.PureComponent {

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

  componentDidUpdate(prevProps) {
    if (
      !_.isEqual(this.props.files, prevProps.files)
    ) {
      this.rebuildState()
    }
  }

  setStateProxy = (data, cb) => {
    if (data.transferList) {
      let tree = data.transferList.reduce((prev, t) => {
        let {localPath, remotePath, type} = t
        let startPath = type === typeMap.local
          ? localPath
          : remotePath
        let targetPath = type === typeMap.local
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
    this.setStateProxy({
      files: [],
      index: 0
    }, () => {
      this.props.modifier({
        filesToConfirm: [],
        transferType: null,
        transports: [
          ...transports,
          ...this.state.transferList
        ]
      })
    })

  }

  skip = async () => {
    let update = await this.getNextIndex(this.state.index)
    this.setStateProxy(update)
  }

  cancel = () => {
    this.props.modifier({
      filesToConfirm: [],
      transferType: null
    })
  }

  getBasePath = (type, props = this.props) => {
    let {
      srcTransferPath,
      targetTransferPath
    } = props
    return type === 'from'
      ? srcTransferPath
      : targetTransferPath
  }

  buildNewName = (name, isDirectory) => {
    if (isDirectory) {
      return name + '__renamed__' + generate()
    }
    return generate() + '__' + 'renamed__' + name
  }

  localCheckExist = async (path) => {
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
    return await this[type + 'CheckExist'](path)
  }

  checkFileExist = async (file, props = this.props) => {
    let {
      path,
      name
    } = file
    let toType = props.targetTransferType
    let basePath = this.getBasePath('from', props)
    let beforePath = resolve(path, name)
    let reg = new RegExp('^' + basePath.replace(/\\/g, '\\\\'))
    let otherPath = this.getBasePath('to', props)
    let targetPath = beforePath.replace(reg, otherPath)
    let targetSep = otherPath.includes('\\')
      ? '\\'
      : '/'
    let fromSep = basePath.includes('\\')
      ? '\\'
      : '/'
    targetPath = targetPath.replace(fromSep, targetSep)
    return await this.checkExist(toType, targetPath, props)
  }

  transferProps = [
    'targetTransferPath',
    'srcTransferPath',
    'targetTransferType',
    'srcTransferType',
    'transferType'
  ]

  buildTransfer = ({file, fromPath, toPath}) => {
    return {
      fromPath,
      toPath,
      id: generate(),
      percent: 0,
      file,
      ..._.pick(
        this.props,
        this.transferProps
      )
    }
  }

  createTransfer = (file, targetPath) => {
    let {name, path} = file
    let fromPath = resolve(path, name)
    let toPath = targetPath || this.getTargetPath(file)
    return this.buildTransfer({
      file,
      fromPath,
      toPath
    })
  }

  findParentTransport = (file) => {
    let path = _.get(file, 'path') || ''
    let {transferList} = this.state
    let len = transferList.length
    for(let i = len - 1;i >= 0;i --) {
      let t = transferList[i]
      if (path === resolve(t.file.path, t.file.name)) {
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
      name
    } = currentFile
    let transferList = copy(this.state.transferList)
    let transport = this.findParentTransport(currentFile)
    let targetPath
    if (transport) {
      targetPath = resolve(transport.toPath, name)
    } else {
      targetPath = this.getTargetPath(currentFile)
    }
    let {targetTransferType} = this.props
    let exist = await this.checkExist(targetTransferType, targetPath)
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
      isDirectory
    } = file
    let basePath = this.getBasePath('from')
    let toBasePath = this.getBasePath('to')
    let regBase = new RegExp('^' + basePath.replace(/\\/g, '\\\\'))
    let targetPath = path.replace(regBase, toBasePath)
    let targetSep = toBasePath.includes('\\')
      ? '\\'
      : '/'
    let fromSep = basePath.includes('\\')
      ? '\\'
      : '/'
    targetPath = targetPath.replace(fromSep, targetSep)
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
      isDirectory,
      path: bp
    } = file
    let {files} = this.state
    let newName = this.buildNewName(name, isDirectory)
    let basePath = this.getBasePath('from')
    let repPath = this.getBasePath('to')
    let beforePath = resolve(bp, name)
    let newPath = resolve(bp, newName)
    let reg = new RegExp('^' + basePath.replace(/\\/g, '\\\\'))
    let reg1 = new RegExp('^' + beforePath.replace(/\\/g, '\\\\'))
    let i = index + 0
    let transferList = copy(this.state.transferList)
    for (;;i ++) {
      let f = files[i] || {}
      let {path, name} = f
      if (
        !path ||
        (!path.startsWith(beforePath) && i > index)
      ) {
        i = i - 1
        break
      }
      let p = resolve(path, name)
      let np = p.replace(reg1, newPath)
      let t = np.replace(reg, repPath)
      let targetSep = repPath.includes('\\')
        ? '\\'
        : '/'
      let fromSep = basePath.includes('\\')
        ? '\\'
        : '/'
      t = t.replace(fromSep, targetSep)
      transferList.push({
        fromPath: p,
        toPath: t,
        id: generate(),
        percent: 0,
        file: f,
        ..._.pick(
          this.props,
          this.transferProps
        )
      })
    }
    await this.setStateAsync({
      transferList
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
    let {currentFile, index} = this.state
    let {isDirectory} = currentFile
    let transferList = copy(this.state.transferList)
    if (!isDirectory) {
      transferList.push(this.createTransfer(currentFile))
      await this.setStateAsync({
        transferList
      })
    }
    let update = await this.getNextIndex(index)
    this.setStateAsync(update)
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
    let firstFile = files[0] || null
    if (!firstFile) {
      return this.setStateProxy({
        currentFile: null
      })
    }
    let exist = await this.checkFileExist(firstFile, nextProps)
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
    let {currentFile, index, files} = this.state
    if (!currentFile) {
      return null
    }
    let {isDirectory} = currentFile
    let hasMoreFile = index < files.length - 1
    return (
      <div className="mgq1t pd1y alignright">
        <Button
          type="ghost"
          className="mg1l"
          onClick={this.cancel}
        >
          {e('cancel')}
        </Button>
        <Button
          type="ghost"
          className="mg1l"
          onClick={this.skip}
        >
          {e('skip')}
        </Button>
        <Button
          type="primary"
          className="mg1l"
          onClick={
            this.mergeOrOverwrite
          }
        >
          {isDirectory ? e('merge') : e('overwrite')}
        </Button>
        <Button
          type="primary"
          className="mg1l"
          onClick={
            this.rename
          }
        >
          {e('rename')}
        </Button>
        <div className="pd1t" />
        {
          hasMoreFile
            ? (
              <Button
                type="ghost"
                className="mg1l"
                title={
                  isDirectory
                    ? e('mergeDesc')
                    : e('overwriteDesc')
                }
                onClick={
                  this.mergeOrOverwriteAll
                }
              >
                {isDirectory ? e('mergeAll') : e('overwriteAll')}
              </Button>
            )
            : null
        }
        {
          hasMoreFile
            ? (
              <Button
                type="primary"
                className="mg1l"
                title={e('renameDesc')}
                onClick={
                  this.renameAll
                }
              >
                {e('renameAll')}
              </Button>
            )
            : null
        }
      </div>
    )
  }

  renderContent = () => {
    let {currentFile} = this.state
    if (!currentFile) {
      return null
    }
    let {
      isDirectory,
      name
    } = currentFile
    let {targetTransferPath} = this.props
    let transport = this.findParentTransport(currentFile)
    let targetPath
    if (transport) {
      targetPath = resolve(targetTransferPath, name)
    } else {
      targetPath = this.getTargetPath(currentFile)
    }
    let {
      srcTransferType,
      targetTransferType,
      fromPath,
      toPath
    } = this.createTransfer(currentFile, targetPath)
    let action = isDirectory ? e('merge') : e('replace')
    let typeTxt = isDirectory ? e('folder') : e('file')
    let typeTitle = targetTransferType === typeMap.local
      ? e(typeMap.local)
      : e(typeMap.remote)
    let otherTypeTitle = srcTransferType === typeMap.remote
      ? e(typeMap.remote)
      : e(typeMap.local)
    return (
      <div className="confirms-content-wrap">
        <AnimateText>
          <p className="pd1b color-red font13">
            {action}
          </p>
          <p className="bold font14">
            {typeTitle} {typeTxt}: <Icon type={typeTxt} className="mg1r" />{name}
          </p>
          <p className="pd1b">
            ({toPath})
          </p>
          <p>
            with
          </p>
          <p className="bold font14">
            {otherTypeTitle} {typeTxt}: <Icon type={typeTxt} className="mg1r" />{name}
          </p>
          <p className="pd1b">
            ({fromPath})
          </p>
        </AnimateText>
      </div>
    )
  }

  render() {
    let {currentFile, index, files} = this.state
    let props = {
      visible: !!currentFile,
      width: 500,
      title: e('fileConflict'),
      footer: this.renderFooter(),
      onCancel: this.cancel
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

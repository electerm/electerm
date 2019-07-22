/**
 * file/directory wait to be confirmed
 */

import React from 'react'
import { Modal, Icon, Button } from 'antd'
import _ from 'lodash'
import copy from 'json-deep-copy'
import { generate } from 'shortid'
import Trigger from './file-transfer-trigger'
import resolve from '../../common/resolve'
import AnimateText from '../common/animate-text'
import { typeMap } from '../../common/constants'
import { getLocalFileInfo, getRemoteFileInfo } from './file-read'

const { prefix } = window
const e = prefix('sftp')

export default class Confirms extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      currentFile: props.files[0] || null,
      files: props.files || [],
      index: 0,
      transferList: [],
      transferTree: {}
    }
  }

  componentWillMount () {
    this.rebuildState()
  }

  componentDidUpdate (prevProps) {
    if (
      !_.isEqual(this.props.files, prevProps.files)
    ) {
      this.rebuildState()
    }
  }

  setStateProxy = (data, cb) => {
    if (data.transferList) {
      const tree = data.transferList.reduce((prev, t) => {
        const { localPath, remotePath, type } = t
        const startPath = type === typeMap.local
          ? localPath
          : remotePath
        const targetPath = type === typeMap.local
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
    this.setStateProxy({
      files: [],
      index: 0
    }, () => {
      this.props.modifier(old => {
        const transports = copy(old.transports)
        const nt = [
          ...transports,
          ...this.state.transferList
        ]
        if (nt.length) {
          this.props.store.editTab(this.props.tab.id, {
            isTransporting: true
          })
        }
        return {
          filesToConfirm: [],
          transferType: null,
          transports: nt
        }
      })
    })
  }

  skip = async () => {
    const update = await this.getNextIndex(this.state.index)
    this.setStateProxy(update)
  }

  cancel = () => {
    this.props.modifier({
      filesToConfirm: [],
      transferType: null
    })
  }

  getBasePath = (type, props = this.props) => {
    const {
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

  localCheckExist = (path) => {
    return getLocalFileInfo(path)
  }

  remoteCheckExist = (path) => {
    const { sftp } = this.props
    return getRemoteFileInfo(sftp, path)
      .then(r => r)
      .catch(() => false)
  }

  checkExist = (type, path) => {
    return this[type + 'CheckExist'](path)
  }

  checkFileExist = (file, props = this.props) => {
    const {
      path,
      name
    } = file
    const toType = props.targetTransferType
    const basePath = this.getBasePath('from', props)
    const beforePath = resolve(path, name)
    const reg = new RegExp('^' + basePath.replace(/\\/g, '\\\\'))
    const otherPath = this.getBasePath('to', props)
    let targetPath = beforePath.replace(reg, otherPath)
    const targetSep = otherPath.includes('\\')
      ? '\\'
      : '/'
    const fromSep = basePath.includes('\\')
      ? '\\'
      : '/'
    targetPath = targetPath.replace(fromSep, targetSep)
    return this.checkExist(toType, targetPath, props)
  }

  transferProps = [
    'targetTransferPath',
    'srcTransferPath',
    'targetTransferType',
    'srcTransferType',
    'transferType'
  ]

  buildTransfer = ({ file, fromPath, toPath }) => {
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
    const { name, path } = file
    const fromPath = resolve(path, name)
    const toPath = targetPath || this.getTargetPath(file)
    return this.buildTransfer({
      file,
      fromPath,
      toPath
    })
  }

  findParentTransport = (file) => {
    const path = _.get(file, 'path') || ''
    const { transferList } = this.state
    const len = transferList.length
    for (let i = len - 1; i >= 0; i--) {
      const t = transferList[i]
      if (path === resolve(t.file.path, t.file.name)) {
        return t
      }
    }
    return null
  }

  getNextIndex = async (currentIndex = this.state.index) => {
    const index = currentIndex + 1
    const currentFile = this.state.files[index] || null
    if (!currentFile) {
      return { index, currentFile }
    }
    const {
      name
    } = currentFile
    const transferList = copy(this.state.transferList)
    const transport = this.findParentTransport(currentFile)
    let targetPath
    if (transport) {
      targetPath = resolve(transport.toPath, name)
    } else {
      targetPath = this.getTargetPath(currentFile)
    }
    const { targetTransferType } = this.props
    const exist = await this.checkExist(targetTransferType, targetPath)
    if (exist) {
      return { index, currentFile }
    }
    const t = this.createTransfer(currentFile, targetPath)
    transferList.push(t)
    await this.setStateAsync({ transferList, index })
    return this.getNextIndex(index)
  }

  getTargetPath = (file, shouldRename = false) => {
    const {
      name,
      path,
      isDirectory
    } = file
    const basePath = this.getBasePath('from')
    const toBasePath = this.getBasePath('to')
    const regBase = new RegExp('^' + basePath.replace(/\\/g, '\\\\'))
    let targetPath = path.replace(regBase, toBasePath)
    const targetSep = toBasePath.includes('\\')
      ? '\\'
      : '/'
    const fromSep = basePath.includes('\\')
      ? '\\'
      : '/'
    targetPath = targetPath.replace(fromSep, targetSep)
    const newName = shouldRename
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
    const {
      name,
      isDirectory,
      path: bp
    } = file
    const { files } = this.state
    const newName = this.buildNewName(name, isDirectory)
    const basePath = this.getBasePath('from')
    const repPath = this.getBasePath('to')
    const beforePath = resolve(bp, name)
    const newPath = resolve(bp, newName)
    const reg = new RegExp('^' + basePath.replace(/\\/g, '\\\\'))
    const reg1 = new RegExp('^' + beforePath.replace(/\\/g, '\\\\'))
    let i = index + 0
    const transferList = copy(this.state.transferList)
    for (;;i++) {
      const f = files[i] || {}
      const { path, name } = f
      if (
        !path ||
        (!path.startsWith(beforePath) && i > index)
      ) {
        i = i - 1
        break
      }
      const p = resolve(path, name)
      const np = p.replace(reg1, newPath)
      let t = np.replace(reg, repPath)
      const targetSep = repPath.includes('\\')
        ? '\\'
        : '/'
      const fromSep = basePath.includes('\\')
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
    const update = await this.getNextIndex(i)
    if (shouldReturn) {
      return update
    }
    this.setStateProxy(update)
  }

  renameAll = async () => {
    let currentFile, index
    const up = await this.rename(
      undefined,
      undefined,
      undefined,
      true
    )
    currentFile = up.currentFile
    index = up.index
    const { files } = this.state
    const { length } = files
    while (index < length) {
      const obj = await this.rename(
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
    const { currentFile, index } = this.state
    const { isDirectory } = currentFile
    const transferList = copy(this.state.transferList)
    if (!isDirectory) {
      transferList.push(this.createTransfer(currentFile))
      await this.setStateAsync({
        transferList
      })
    }
    const update = await this.getNextIndex(index)
    this.setStateAsync(update)
  }

  mergeOrOverwriteAll = async () => {
    const { files, index } = this.state
    let i = index
    const transferList = copy(this.state.transferList)
    const len = files.length
    for (;i < len; i++) {
      const f = files[i]
      const { isDirectory } = f
      const exist = await this.checkFileExist(f)
      if (!exist || !isDirectory) {
        transferList.push(this.createTransfer({
          ...f,
          targetFile: exist
        }))
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
    const { files } = nextProps
    const firstFile = files[0] || null
    if (!firstFile) {
      return this.setStateProxy({
        currentFile: null
      })
    }
    const exist = await this.checkFileExist(firstFile, nextProps)
    if (exist) {
      return this.setStateProxy({
        currentFile: {
          ...firstFile,
          targetFile: exist
        },
        files,
        index: 0,
        transferList: []
      })
    }

    await this.setStateAsync({
      transferList: [this.createTransfer(firstFile)],
      files
    })

    const update = await this.getNextIndex(0)

    this.setStateProxy(update)
  }

  renderFooter () {
    const { currentFile, index, files } = this.state
    if (!currentFile) {
      return null
    }
    const { isDirectory } = currentFile
    const hasMoreFile = index < files.length - 1
    return (
      <div className='mgq1t pd1y alignright'>
        <Button
          type='ghost'
          className='mg1l'
          onClick={this.cancel}
        >
          {e('cancel')}
        </Button>
        <Button
          type='ghost'
          className='mg1l'
          onClick={this.skip}
        >
          {e('skip')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            this.mergeOrOverwrite
          }
        >
          {isDirectory ? e('merge') : e('overwrite')}
        </Button>
        <Button
          type='primary'
          className='mg1l'
          onClick={
            this.rename
          }
        >
          {e('rename')}
        </Button>
        <div className='pd1t' />
        {
          hasMoreFile
            ? (
              <Button
                type='ghost'
                className='mg1l'
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
                type='primary'
                className='mg1l'
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
    const { currentFile } = this.state
    if (!currentFile) {
      return null
    }
    const {
      isDirectory,
      name
    } = currentFile
    const { targetTransferPath } = this.props
    const transport = this.findParentTransport(currentFile)
    let targetPath
    if (transport) {
      targetPath = resolve(targetTransferPath, name)
    } else {
      targetPath = this.getTargetPath(currentFile)
    }
    const {
      srcTransferType,
      targetTransferType,
      fromPath,
      toPath
    } = this.createTransfer(currentFile, targetPath)
    const action = isDirectory ? e('merge') : e('replace')
    const typeTxt = isDirectory ? e('folder') : e('file')
    const typeTitle = targetTransferType === typeMap.local
      ? e(typeMap.local)
      : e(typeMap.remote)
    const otherTypeTitle = srcTransferType === typeMap.remote
      ? e(typeMap.remote)
      : e(typeMap.local)
    return (
      <div className='confirms-content-wrap'>
        <AnimateText>
          <p className='pd1b color-red font13'>
            {action}
          </p>
          <p className='bold font14'>
            {typeTitle} {typeTxt}: <Icon type={typeTxt} className='mg1r' />{name}
          </p>
          <p className='pd1b'>
            ({toPath})
          </p>
          <p>
            with
          </p>
          <p className='bold font14'>
            {otherTypeTitle} {typeTxt}: <Icon type={typeTxt} className='mg1r' />{name}
          </p>
          <p className='pd1b'>
            ({fromPath})
          </p>
        </AnimateText>
      </div>
    )
  }

  render () {
    const { currentFile, index, files } = this.state
    const props = {
      visible: !!currentFile,
      width: 500,
      title: e('fileConflict'),
      footer: this.renderFooter(),
      onCancel: this.cancel
    }
    const triggerProps = {
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

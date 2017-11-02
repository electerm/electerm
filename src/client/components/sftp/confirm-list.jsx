/**
 * file/directory wait to be confirmed
 */

import React from 'react'
import {Modal, Icon, Button} from 'antd'
import _ from 'lodash'
import copy from 'json-deep-copy'
import {generate} from 'shortid'

export default class Confirms extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      currentFile: props.files[0] || null,
      files: [],
      index: 0,
      transferList: [],
      renameFunctions: []
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      !_.isEqual(this.props.files, nextProps.files)
    ) {
      this.rebuildState(nextProps)
    }
  }

  submit = () => {

  }

  checkNextFile = () => {

  }

  skip = () => {
    let {index, files} = this.state
    index ++
    let currentFile = files[index]
    if (!currentFile) {
      this.setState({
        currentFile
      }, this.submit)
    }
  }

  cancel = () => {
    this.rebuildState({files: []})
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

  rename = () => {
    let {
      name,
      type,
      path,
      isDirectory
    } = this.state.currentFile
    let newName = this.getNewName(path)
    let renameFunctions = copy(this.state.renameFunctions)
    let reg = new RegExp(`${name}$`)
    let str1 = newName.replace(
      reg, this.buildNewName(name, isDirectory)
    )
    renameFunctions.push(n => {
      return n.replace(newName, str1)
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

  rebuildState = nextProps => {
    let {files} = nextProps
    this.setState({
      currentFile: copy(files[0] || null),
      files,
      index: 0,
      transferList: []
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

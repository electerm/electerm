/**
 * file/directory wait to be confirmed
 */

import React from 'react'
import {Modal, Icon, Input, Button} from 'antd'
import _ from 'lodash'
import copy from 'json-deep-copy'

export default class Confirms extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      currentFile: props.files[0] || null,
      files: [],
      overwriteStrategy: null
    }
  }

  componentWillReceiveProps(nextProps) {
    if (
      !_.isEqual(this.props.files, nextProps.files)
    ) {
      this.rebuildState(nextProps)
    }
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
      files
    })
  }

  renderFooter() {
    let {currentFile} = this.state
    if (!currentFile) {
      return null
    }
    let {isDirectory, name} = currentFile
    return (
      <div className="bordert mgq1t pd1y alignright">
        <Button
          type="ghost"
          className="mg1l"
          title="cancel this transfer"
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
            isDirectory ? this.merge : this.overwrite
          }
        >
          {isDirectory ? 'merge' : 'overwrite'}
        </Button>
        <Button
          type="ghost"
          className="mg1l"
          onClick={
            isDirectory ? this.mergeAll : this.overwriteAll
          }
        >
          {isDirectory ? 'merge all' : 'overwrite all'}
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

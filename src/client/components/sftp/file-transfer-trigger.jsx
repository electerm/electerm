/**
 * file transfer trigger component
 */

import React from 'react'

export default class FileTransferTrigger extends React.Component {

  componentWillReceiveProps(nextProps) {
    let filesLen = (nextProps.files || []).length
    let {index} = nextProps
    let {index: oldIndex} = this.props
    let filesLenOld = (this.props.files || []).length
    debug(index, 'index @ trigger')
    debug(filesLenOld, 'filesLenOld')
    debug(filesLen, 'filesLen')
    if (
      index >= filesLen &&
      oldIndex < index &&
      filesLen
    ) {
      this.props.submit()
    }
  }

  render() {
    return null
  }
}

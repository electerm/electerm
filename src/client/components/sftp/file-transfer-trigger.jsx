/**
 * file transfer trigger component
 */

import React from 'react'

export default class FileTransferTrigger extends React.Component {

  componentWillReceiveProps(nextProps) {
    let filesLen = nextProps.files.length
    let {index} = nextProps
    let filesLenOld = this.props.files.length
    if (
      index > filesLen &&
      filesLenOld === filesLen
    ) {
      this.props.submit()
    }
  }

  render() {
    return null
  }
}

/**
 * file transfer trigger component
 */

import React from 'react'

export default class FileTransferTrigger extends React.Component {

  componentWillReceiveProps(nextProps) {
    let filesLen = (nextProps.files || []).length
    let {index} = nextProps
    let {index: oldIndex} = this.props
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

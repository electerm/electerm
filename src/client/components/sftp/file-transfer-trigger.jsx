/**
 * file transfer trigger component
 */

import React from 'react'

export default class FileTransferTrigger extends React.PureComponent {

  componentDidUpdate(prevProps) {
    let filesLen = (this.props.files || []).length
    let {index} = this.props
    let {index: oldIndex} = prevProps
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

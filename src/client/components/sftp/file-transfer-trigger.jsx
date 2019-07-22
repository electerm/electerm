/**
 * file transfer trigger component
 */

import React from 'react'

export default class FileTransferTrigger extends React.PureComponent {
  componentDidUpdate (prevProps) {
    const filesLen = (this.props.files || []).length
    const { index } = this.props
    const { index: oldIndex } = prevProps
    if (
      index >= filesLen &&
      oldIndex < index &&
      filesLen
    ) {
      this.props.submit()
    }
  }

  render () {
    return null
  }
}

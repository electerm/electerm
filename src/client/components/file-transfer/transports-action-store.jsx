/**
 * pass transfer list from props
 * when list changes, do transfer and other op
 */

import { Component } from 'react'
import Transports from './transports-ui-store'
import { maxTransport } from '../../common/constants'

export default class TransportsActionStore extends Component {
  componentDidMount () {
    this.control()
  }

  componentDidUpdate (prevProps) {
    if (
      prevProps.fileTransferChanged !== this.props.fileTransferChanged
    ) {
      this.control()
    }
  }

  control = async () => {
    const { store } = window
    const {
      fileTransfers
    } = store

    fileTransfers.forEach(t => {
      const {
        typeTo,
        typeFrom,
        fromFile,
        inited
      } = t
      const ready = !!fromFile
      if (typeTo === typeFrom && ready && !inited) {
        t.inited = true
      }
    })
    // if (pauseAllTransfer) {
    //   return store.setFileTransfers(fileTransfers)
    // }
    let count = fileTransfers.filter(t => {
      const {
        typeTo,
        typeFrom,
        inited,
        pausing
      } = t
      return typeTo !== typeFrom && inited && pausing !== true
    }).length
    if (count >= maxTransport) {
      return
    }
    const len = fileTransfers.length
    // const ids = []
    for (let i = 0; i < len; i++) {
      const tr = fileTransfers[i]
      const {
        typeTo,
        typeFrom,
        inited,
        fromFile,
        action
      } = tr
      // if (!error) {
      //   ids.push(id)
      // }
      const isTransfer = typeTo !== typeFrom
      const ready = (
        action && fromFile
      )
      if (
        !ready ||
        inited ||
        !isTransfer
      ) {
        continue
      }
      // if (isTransfer && tr.fromFile.isDirectory) {
      //   i = len
      //   continue
      // }
      if (
        fromFile && count < maxTransport
      ) {
        count++
        tr.inited = true
      }
      if (count >= maxTransport) {
        break
      }
    }
  }

  render () {
    return (
      <Transports {...this.props} />
    )
  }
}

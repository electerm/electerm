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
      prevProps._fileTransfers !== this.props._fileTransfers
    ) {
      this.control()
    }
  }

  control = async () => {
    const { store } = window
    let {
      fileTransfers
    } = this.props

    fileTransfers = fileTransfers.map(t => {
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
      return t
    })
    // if (pauseAllTransfer) {
    //   return store.setFileTransfers(fileTransfers)
    // }
    let count = fileTransfers.filter(t => {
      const {
        typeTo,
        typeFrom,
        inited
      } = t
      return typeTo !== typeFrom && inited
    }).length
    if (count >= maxTransport) {
      return store.setFileTransfers(fileTransfers)
    }
    const len = fileTransfers.length
    const ids = []
    for (let i = 0; i < len; i++) {
      const tr = fileTransfers[i]
      const {
        typeTo,
        typeFrom,
        inited,
        fromFile,
        error,
        id,
        action
      } = tr
      if (!error) {
        ids.push(id)
      }
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
    }
    store.setFileTransfers(fileTransfers)
  }

  render () {
    return (
      <Transports {...this.props} />
    )
  }
}

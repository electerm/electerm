/**
 * pass transfer list from props
 * when list changes, do transfer and other op
 */

import { Component } from 'react'
import Transports from './transports-ui-store'
import { maxTransport } from '../../common/constants'
// import { action } from 'manate'

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
    console.log('control')
    const { store } = window
    const {
      fileTransfers
    } = store
    for (const t of fileTransfers) {
      const {
        typeTo,
        typeFrom,
        inited
      } = t
      console.log('t', JSON.stringify(t, null, 2))
      if (typeTo === typeFrom && !inited) {
        console.log('t21', t)
        // t.inited = true
        setTimeout(() => {
          console.log('t22', t)
          t.inited = true
        }, 100)
      }
    }
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
        action
      } = tr
      // if (!error) {
      //   ids.push(id)
      // }
      const isTransfer = typeTo !== typeFrom
      const ready = !!action
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
        count < maxTransport
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

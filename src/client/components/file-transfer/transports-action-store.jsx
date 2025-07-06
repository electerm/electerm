/**
 * pass transfer list from props
 * when list changes, do transfer and other op
 */

import { Component } from 'react'
import Transports from './transports-ui-store'
import { maxTransport } from '../../common/constants'
import { refsStatic } from '../common/ref'
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
    const { store } = window
    const {
      fileTransfers
    } = store

    // First loop: Handle same type transfers
    for (const t of fileTransfers) {
      const {
        typeTo,
        typeFrom,
        inited,
        id
      } = t
      if (typeTo === typeFrom && !inited) {
        refsStatic.get('transfer-queue')?.addToQueue(
          'update',
          id,
          {
            inited: true
          }
        )
      }
    }

    // Count active transfers
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

    // Second loop: Process pending transfers
    const len = fileTransfers.length

    for (let i = 0; i < len; i++) {
      const tr = fileTransfers[i]
      const {
        typeTo,
        typeFrom,
        inited,
        id
      } = tr

      const isTransfer = typeTo !== typeFrom

      if (inited || !isTransfer) {
        continue
      }

      if (count < maxTransport) {
        count++
        refsStatic.get('transfer-queue')?.addToQueue(
          'update',
          id,
          {
            inited: true
          }
        )
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

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
    console.log('control function started')
    const { store } = window
    const {
      fileTransfers
    } = store
    console.log('Current fileTransfers:', fileTransfers.length, 'items')

    // First loop: Handle same type transfers
    console.log('Starting first loop - checking for same type transfers')
    for (const t of fileTransfers) {
      const {
        typeTo,
        typeFrom,
        inited,
        id
      } = t
      console.log('Checking transfer:', { id, typeTo, typeFrom, inited })
      if (typeTo === typeFrom && !inited) {
        console.log('Found same type transfer, marking as inited:', id)
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
    console.log('Current active transfers count:', count)

    if (count >= maxTransport) {
      console.log('Max transport limit reached, exiting')
      return
    }

    // Second loop: Process pending transfers
    const len = fileTransfers.length
    console.log('Starting second loop - processing pending transfers, total items:', len)

    for (let i = 0; i < len; i++) {
      const tr = fileTransfers[i]
      const {
        typeTo,
        typeFrom,
        inited,
        id
      } = tr
      console.log('Processing transfer:', tr)

      const isTransfer = typeTo !== typeFrom

      if (inited || !isTransfer) {
        console.log('Skipping transfer - not ready or already inited or not a transfer')
        continue
      }

      if (count < maxTransport) {
        count++
        console.log('Initializing transfer, new count:', count, 'id:', tr.id)
        refsStatic.get('transfer-queue')?.addToQueue(
          'update',
          id,
          {
            inited: true
          }
        )
      }

      if (count >= maxTransport) {
        console.log('Max transport limit reached during processing, breaking loop')
        break
      }
    }
    console.log('Control function completed')
  }

  render () {
    return (
      <Transports {...this.props} />
    )
  }
}

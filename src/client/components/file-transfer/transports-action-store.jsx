/**
 * pass transfer list from props
 * when list changes, do transfer and other op
 */

import { Component } from 'react'
import Transports from './transports-ui-store'
import { maxTransport } from '../../common/constants'
import { refsStatic } from '../common/ref'
// import { action } from 'manate'

window.initingFtpTabIds = new Set()

export default class TransportsActionStore extends Component {
  constructor (props) {
    super(props)
    this.pendingInitIds = new Set()
  }

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
    this.pendingInitIds = new Set(
      Array.from(this.pendingInitIds).filter(id => {
        const transfer = fileTransfers.find(t => t.id === id)
        return transfer && transfer.inited !== true
      })
    )

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
      return typeTo !== typeFrom && (inited || this.pendingInitIds.has(t.id)) && pausing !== true
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
        id,
        tabType,
        tabId
      } = tr

      const isTransfer = typeTo !== typeFrom

      if (inited || this.pendingInitIds.has(id) || !isTransfer) {
        continue
      }

      // For ftp transfers, ensure only one per tabId is inited
      if (tabType === 'ftp') {
        const hasInited = fileTransfers.some(t => t.tabId === tabId && t.inited && t.id !== id)
        if (hasInited || window.initingFtpTabIds.has(tabId)) {
          continue
        }
        window.initingFtpTabIds.add(tabId)
      }

      if (count < maxTransport) {
        count++
        this.pendingInitIds.add(id)
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

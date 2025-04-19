import { Component } from 'react'
import { autoRun } from 'manate'
import { refsStatic } from '../common/ref'

export default class Queue extends Component {
  constructor (props) {
    super(props)
    this.queue = []
    this.currentRun = null
    this.id = 'transfer-queue'
    refsStatic.add(this.id, this)
  }

  componentWillUnmount () {
    if (this.currentRun) {
      this.currentRun.stop()
    }
  }

  addToQueue = (operation, ...args) => {
    console.log('Adding to queue:', operation, args)
    // this.setState(prevState => ({
    //   queue: [...prevState.queue, { operation, args }]
    // }), this.processQueue)
    this.queue.push({ operation, args })
    this.processQueue()
  }

  processQueue = async () => {
    if (this.queue.length === 0 || this.processing === true) {
      return
    }
    this.processing = true
    const { operation, args } = this.queue.shift()
    console.log('Processing queue:', operation, ...args)

    await this.executeOperation(operation, ...args)
      .then(() => {
        console.log('Operation completed:', operation, ...args)
      })
      .catch((error) => {
        console.error('Error processing operation:', error)
      })
    this.processing = false
    this.processQueue()
  }

  executeOperation = (operation, ...args) => {
    console.log('Executing operation:', operation, args)
    return new Promise((resolve, reject) => {
      const { fileTransfers } = window.store
      const [id, updateObj] = args
      const end = () => {
        this.currentRun && this.currentRun.stop()
        resolve()
      }

      // Determine if this is a simple operation (same-side cp) vs a file transfer
      const isTransferInit = updateObj && updateObj.inited === true

      // For file transfers, set up autoRun before modifying data
      if (isTransferInit) {
        this.currentRun = autoRun(() => {
          checkCompletion()
        })
        this.currentRun.start()

        // Use setTimeout for transfer operations to give autoRun time to initialize
        setTimeout(() => {
          applyChanges()
        }, 1)
      } else {
        // For same-side operations, just apply changes immediately
        applyChanges()

        // Still set up autoRun as a safety net, but we won't need it usually
        this.currentRun = autoRun(() => {
          checkCompletion()
        })
        this.currentRun.start()
      }

      function applyChanges () {
        if (operation === 'update') {
          const index = fileTransfers.findIndex(t => t.id === id)
          console.log('update', index, updateObj, id, fileTransfers)
          if (index < 0) {
            return end()
          }
          Object.assign(fileTransfers[index], updateObj)
        } else if (operation === 'delete') {
          const index = fileTransfers.findIndex(t => t.id === id)
          if (index < 0) {
            return end()
          }
          fileTransfers.splice(index, 1)
        } else if (operation === 'insert') {
          fileTransfers.push(id)
        }

        // For non-transfer operations, check immediately
        if (!isTransferInit) {
          checkCompletion()
        }
      }

      function checkCompletion () {
        if (operation === 'update') {
          const index = window.store.fileTransfers.findIndex(t => t.id === id)
          const updatedTransfer = index >= 0 ? window.store.fileTransfers[index] : null

          if (updatedTransfer && updateObj) {
            const allUpdated = Object.keys(updateObj).every(key => {
              const updatedValue = updatedTransfer[key]
              const expectedValue = updateObj[key]

              if (expectedValue && typeof expectedValue === 'object') {
                return updatedValue !== undefined
              }
              return updatedValue === expectedValue
            })

            if (allUpdated) {
              console.log('Update confirmed for:', id)
              end()
            }
          }
        } else if (operation === 'delete') {
          const stillExists = window.store.fileTransfers.some(t => t.id === id)
          if (!stillExists) {
            console.log('Delete confirmed for:', id)
            end()
          }
        } else if (operation === 'insert') {
          const exists = window.store.fileTransfers.some(t => t.id === id)
          if (exists) {
            console.log('Insert confirmed for:', id)
            end()
          }
        }
      }
    })
  }

  render () {
    return null // This component doesn't render anything
  }
}

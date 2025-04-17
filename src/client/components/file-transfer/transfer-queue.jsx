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
        this.currentRun.stop()
        clearTimeout(this.tm)
        resolve()
      }
      const checkCompletion = () => {
        if (operation === 'update') {
          const index = window.store.fileTransfers.findIndex(t => t.id === id)
          // Check if update was successful
          const updatedTransfer = index >= 0 ? window.store.fileTransfers[index] : null

          if (updatedTransfer && updateObj) {
            // Check if all properties were updated
            const allUpdated = Object.keys(updateObj).every(key => {
              const updatedValue = updatedTransfer[key]
              const expectedValue = updateObj[key]

              // If expectedValue is an object, just check if the property exists
              if (expectedValue && typeof expectedValue === 'object') {
                return updatedValue !== undefined && updatedValue !== undefined
              }

              // For primitive values, do direct comparison
              return updatedValue === expectedValue
            })

            if (allUpdated) {
              console.log('Update confirmed for:', id)
              end()
            }
          }
        } else if (operation === 'delete') {
          // Check if delete was successful
          const stillExists = window.store.fileTransfers.some(t => t.id === id)
          if (!stillExists) {
            console.log('Delete confirmed for:', id)
            end()
          }
        } else if (operation === 'insert') {
          // Check if insert was successful
          const exists = window.store.fileTransfers.some(t => t.id === id)
          if (exists) {
            console.log('Insert confirmed for:', id)
            end()
          }
        }
      }
      this.currentRun = autoRun(() => {
        // console.log('========auto run', operation, id)
        checkCompletion()
        // return JSON.stringify(window.store.fileTransfers)
      })
      this.currentRun.start()
      setTimeout(() => {
        if (operation === 'update') {
          const index = fileTransfers.findIndex(t => t.id === id)
          console.log('update', index, updateObj, id, fileTransfers)
          if (index < 0) {
            return end()
          }
          Object.assign(
            fileTransfers[
              index
            ], updateObj)
        } else if (operation === 'delete') {
          const index = fileTransfers.findIndex(t => t.id === id)
          if (index < 0) {
            return end()
          }
          fileTransfers.splice(
            index,
            1
          )
        } else if (operation === 'insert') {
          fileTransfers.push(id)
        }
      }, 1)

      // // Set a timeout to stop watching if no changes occur
      // this.tm = setTimeout(end, 1000) // 5 second timeout
    })
  }

  render () {
    return null // This component doesn't render anything
  }
}

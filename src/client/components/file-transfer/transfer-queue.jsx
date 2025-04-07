import { Component } from 'react'
import { autoRun } from 'manate'
import { refsStatic } from '../common/ref'

export default class Queue extends Component {
  constructor (props) {
    super(props)
    this.state = {
      queue: [],
      isProcessing: false
    }
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
    this.setState(prevState => ({
      queue: [...prevState.queue, { operation, args }]
    }), this.processQueue)
  }

  processQueue = async () => {
    if (this.state.isProcessing || this.state.queue.length === 0) {
      return
    }

    this.setState({ isProcessing: true })

    const { operation, args } = this.state.queue[0]

    try {
      await this.executeOperation(operation, ...args)
    } catch (error) {
      console.error('Error executing operation:', error)
    }

    this.setState(prevState => ({
      queue: prevState.queue.slice(1),
      isProcessing: false
    }), this.processQueue)
  }

  executeOperation = (operation, ...args) => {
    return new Promise((resolve, reject) => {
      const { fileTransfers } = window.store
      const [id, updateObj] = args
      switch (operation) {
        case 'delete':
          fileTransfers.splice(
            fileTransfers.findIndex(t => t.id === id),
            1
          )
          break
        case 'insert':
          fileTransfers.push(id)
          break
        case 'update':
          Object.assign(
            fileTransfers[
              fileTransfers.findIndex(t => t.id === id)
            ], updateObj)
          break
        case 'custom':
          id(fileTransfers)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      // Start watching for changes
      this.currentRun = autoRun(() => {
        this.currentRun.stop()
        resolve()
        return window.store.fileTransfers
      })
      this.currentRun.start()

      // Set a timeout to stop watching if no changes occur
      setTimeout(() => {
        if (this.currentRun) {
          this.currentRun.stop()
          reject(new Error('Operation timed out'))
        }
      }, 5000) // 5 second timeout
    })
  }

  delete = (index) => {
    this.addToQueue('delete', index)
  }

  insert = (index, item) => {
    this.addToQueue('insert', index, item)
  }

  update = (index, updateObj) => {
    this.addToQueue('update', index, updateObj)
  }

  custom = (customFunction) => {
    this.addToQueue('custom', customFunction)
  }

  render () {
    return null // This component doesn't render anything
  }
}

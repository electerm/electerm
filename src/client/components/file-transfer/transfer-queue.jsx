import { Component } from 'react'
import { autoRun } from 'manate'
import { refsStatic } from '../common/ref'

export default class Queue extends Component {
  constructor (props) {
    super(props)
    this.state = {
      queue: []
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
    console.log('Adding to queue:', operation, args)
    this.setState(prevState => ({
      queue: [...prevState.queue, { operation, args }]
    }), this.processQueue)
  }

  processQueue = async () => {
    if (this.state.queue.length === 0) {
      return
    }

    const { operation, args } = this.state.queue[0]

    try {
      await this.executeOperation(operation, ...args)
    } catch (error) {
      console.error('Error executing operation:', error)
    }

    this.setState(prevState => ({
      queue: prevState.queue.slice(1)
    }), this.processQueue)
  }

  executeOperation = (operation, ...args) => {
    console.log('Executing operation:', operation, args)
    return new Promise((resolve, reject) => {
      const { fileTransfers } = window.store
      const [id, updateObj] = args
      this.currentRun = autoRun(() => {
        this.currentRun.stop()
        resolve()
        return window.store.fileTransfers
      })
      this.currentRun.start()
      function end () {
        this.currentRun.stop()
        resolve()
      }
      if (operation === 'update') {
        const index = fileTransfers.findIndex(t => t.id === id)
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
      } else if (operation === 'custom') {
        id(fileTransfers)
      }

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

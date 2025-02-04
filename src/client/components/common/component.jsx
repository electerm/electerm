import React from 'react'
import writeEmitter from 'manate/events/write-emitter'
import { run } from 'manate/utils'

export class Component extends React.Component {
  constructor (props) {
    super(props)
    this.isTrigger = null
    this.originalRender = this.render
    this.render = this.autoRender

    const originalDidMount = this.componentDidMount
    this.componentDidMount = () => {
      writeEmitter.on(this.handleWrite)
      if (originalDidMount) {
        originalDidMount.call(this)
      }
    }

    const originalWillUnmount = this.componentWillUnmount
    this.componentWillUnmount = () => {
      writeEmitter.off(this.handleWrite)
      if (originalWillUnmount) {
        originalWillUnmount.call(this)
      }
    }
  }

  handleWrite = (writeLog) => {
    if (this.isTrigger && this.isTrigger(writeLog)) {
      this.forceUpdate()
    }
  }

  autoRender = () => {
    const [element, isTrigger] = run(() => {
      return this.originalRender()
    })
    this.isTrigger = isTrigger
    return element
  }
}

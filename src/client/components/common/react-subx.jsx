import React from 'react'
import SubX from 'subx'
import * as R from 'ramda'
import _ from 'lodash'

function picker(props) {
  return Object.keys(props).reduce((prev, k) => {
    let v = props[k]
    if (k !== 'store' && !_.isFunction(v)) {
      prev[k] = v
    }
    return prev
  }, {})
}

export class Component extends React.Component {
  constructor (props = {}) {
    super(props)
    const clearSubscription = () => {
      if (this.__subscription__) {
        this.__subscription__.unsubscribe()
        delete this.__subscription__
      }
    }
    const render = this.render.bind(this)
    this.render = () => {
      clearSubscription()
      const { result, stream$ } = SubX.runAndMonitor(props.store || SubX.create(props), render)
      this.__subscription__ = stream$.subscribe(event => {
        if (event.type === 'STALE' && R.equals(R.path(event.path, props.store || props), event.cache)) {
          return
        }
        clearSubscription()
        this.forceUpdate()
      })
      return result
    }
    if (this.componentWillUnmount) {
      const originalComponentWillUnmount = this.componentWillUnmount.bind(this)
      this.componentWillUnmount = () => {
        clearSubscription()
        originalComponentWillUnmount()
      }
    } else {
      this.componentWillUnmount = () => clearSubscription()
    }
    this.shouldComponentUpdate = (nextProps, nextState) => {
      return !_.isEqual(
        nextState, this.state
      ) || !_.isEqual(
        picker(nextProps),
        picker(this.props)
      )
    }
  }
}

export default { Component }

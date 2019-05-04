import React from 'react'
import SubX from 'subx'
import * as R from 'ramda'
import _ from 'lodash'

export class Component extends React.Component {
  constructor (props) {
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
      const { result, stream$ } = SubX.runAndMonitor(props.store, render)
      this.__subscription__ = stream$.subscribe(event => {
        if (event.type === 'STALE' && R.equals(R.path(event.path, props.store), event.cache)) {
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
      if (!_.isEqual(this.state, nextState)) {
        return true
      }
      let keys = _.without(Object.keys(nextProps), 'store')
      let old = _.pick(this.props, keys)
      let nn = _.pick(nextProps, keys)
      return !_.isEqual(old, nn)
    }
  }
}

export default { Component }

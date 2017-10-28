/**
 * input with auto focus
 */

import {Input} from 'antd'
import React from 'react'
import ReactDOM from 'react-dom'

export default class InputAutoFocus extends React.Component {

  componentDidMount() {
    this.timer = setTimeout(this.doFocus, 50)
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  doFocus = () => {
    let dom = this.getDom()
    dom && dom.focus && dom.select()
  }

  getDom() {
    let root = ReactDOM.findDOMNode(this)
    let dom = root.tagName === 'INPUT'
      ? root
      : root.querySelector('input')
    return dom
  }

  render() {
    return (
      <Input
        {...this.props}
      />
    )
  }

}

/**
 * input with auto focus
 */

import {Input} from 'antd'
import React from 'react'
import ReactDOM from 'react-dom'

export default class InputAutoFocus extends React.Component {

  componentDidMount() {
    let dom = this.getDom()
    dom && dom.focus && dom.focus()
  }

  getDom() {
    let root = ReactDOM.findDOMNode(this)
    let dom = root.querySelector('input')
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

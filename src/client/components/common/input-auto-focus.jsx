/**
 * input with auto focus
 */

import {Input} from 'antd'
import React from 'react'
import ReactDOM from 'react-dom'
import _ from 'lodash'

export default class InputAutoFocus extends React.Component {

  componentDidMount() {
    this.timer = setTimeout(this.doFocus, 50)
  }

  componentWillUnmount() {
    clearTimeout(this.timer)
  }

  doFocus = () => {
    let dom = this.getDom()
    if (dom && dom.focus) {
      let {value} = this.props
      let index = _.findLastIndex(value, v => v === '.')
      let hasExt = index > 0
      if (value && hasExt) {
        dom.focus()
        dom.setSelectionRange(0, index)
      }
      else {
        dom.select()
      }
    }
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

/**
 * input with auto focus
 */

import { Input } from 'antd'
import React from 'react'
import ReactDOM from 'react-dom'
import _ from 'lodash'

export default class InputAutoFocus extends React.PureComponent {
  componentDidMount () {
    this.timer = setTimeout(this.doFocus, 50)
  }

  componentDidUpdate (prevProps) {
    if (!prevProps.selectall) {
      return
    }
    if (prevProps.autofocustrigger !== this.props.autofocustrigger) {
      this.timer = setTimeout(this.doFocus, 50)
    }
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  doFocus = () => {
    const dom = this.getDom()
    if (dom && dom.focus) {
      const { value, selectall = false } = this.props
      const index = _.findLastIndex(value, v => v === '.')
      const hasExt = index > 0
      if (value && !selectall && hasExt) {
        dom.focus()
        dom.setSelectionRange(0, index)
      } else {
        dom.select()
      }
    }
  }

  getDom () {
    const root = ReactDOM.findDOMNode(this)
    const dom = root.tagName === 'INPUT'
      ? root
      : root.querySelector('input')
    return dom
  }

  render () {
    const { type, ...rest } = this.props
    const Dom = type === 'password'
      ? Input.Password
      : Input
    return (
      <Dom
        {...rest}
      />
    )
  }
}

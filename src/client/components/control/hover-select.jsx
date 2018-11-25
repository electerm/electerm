/**
 * hover to show dropdown instead of click to show for better user experience
 */

import {Select} from 'antd'
import ReactDOM from 'react-dom'
import React from 'react'

export default class HoverSelect extends React.Component {

  componentDidMount() {
    let dom = ReactDOM.findDOMNode(this)
    this.dom = dom
    dom.addEventListener('mouseenter', this.mouseenter)
  }

  mouseenter = () => {
    this.dom.click()
  }

  render() {
    return (
      <Select
        {...this.props}
      />
    )
  }
}

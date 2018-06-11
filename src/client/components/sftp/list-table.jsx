/**
 * file list table
 * features:
 * - drag to resize table
 * - context menu to set props to show
 * - click header to sort
 */

/**
 * make child component resizable by drag the horizontal or vertical handle
 */

import {Component} from 'react'
//import classnames from 'classnames'
//import _ from 'lodash'

export default class ResizeWrap extends Component {

  constructor(props) {
    super(props)
    this.state = {
      props: this.getPropsDefault(),
      splitIds: []
    }
  }

  getPropsDefault = () => {
    return [
      'name',
      'size',
      'modifyTime'
    ]
  }

  getPropsAll = () => {
    return [
      'name',
      'size',
      'modifyTime',
      'accessTime',
      'mode',
      'path'
    ]
  }

  render() {
    return null
  }
}

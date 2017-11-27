/**
 * drag to select file/folder
 */

import React from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'

export default class DragSelect extends React.Component {

  static propTypes = {
    className: PropTypes.string,
    wrapperSelector: PropTypes.string,
    targetSelector: PropTypes.string,
    onSelect: PropTypes.func, // (fileIds: [string]) => ...
    style: PropTypes.object
  }

  static defaultProps = {
    className: 'drag-select-mask',
    targetSelector: '.sftp-item',
    wrapperSelector: '.virtual-file',
    style: {}
  }

  state = {
    maskStyle: {
      width: 0,
      height: 0,
      left: 0,
      top: 0
    },
    onDrag: false,
    endPoint: null,
    startPoint: null
  }

  componentDidMount() {
    this.initEvents()
  }

  componentWillUnmount() {
    this.destroyEvents()
  }

  initEvents() {
    debug('init')
    // let root = document.querySelector(this.props.wrapperSelector)
    // if (!root) {
    //   return
    // }
    //this.root = root
    window.addEventListener('mousedown', this.onMousedown)
    window.addEventListener('mouseup', this.onMouseup)
  }

  mousemove = e => {
    let endPoint = {
      x: e.pageX,
      y: e.pageY
    }
    this.setState({
      endPoint
    })
  }

  onMousedown = e => {
    debug('md', e.target)
    let startPoint = {
      x: e.pageX,
      y: e.pageY
    }
    this.setState({
      onDrag: true,
      startPoint
    })
    window.addEventListener('mousemove', this.mousemove)
  }

  onMouseup = () => {
    window.removeEventListener('mousemove', this.mousemove)
    let style = this.computeMaskPosition()
    this.computeSelectedFiles(style)
    this.setState({
      onDrag: false,
      startPoint: null,
      endPoint: null
    })
  }

  checkIntersects = (arr1, arr2) => {
    return arr1[1] > arr2[0] || arr1[0] < arr2[1]
  }

  checkInSelect = (rect, style) => {
    let xs1 = [rect.left, rect.left + rect.width]
    let ys1 = [rect.top, rect.top + rect.height]
    let xs2 = [style.left, style.left + rect.width]
    let ys2 = [style.top, style.top + rect.height]
    return this.checkIntersects(xs1, xs2) &&
      this.checkIntersects(ys1, ys2)
  }

  computeSelectedFiles = (style) => {
    let {targetSelector} = this.props
    let doms = Array.from(document.querySelectorAll(targetSelector))
    let ids = doms
      .filter(dom => {
        let rect = dom.getBoundingClientRect()
        return this.checkInSelect(rect, style)
      })
      .map(dom => dom.getAttribute('id'))
    this.props.onSelect(ids)
  }

  computeMaskPosition = () => {
    let {startPoint, endPoint} = this.state
    debug(startPoint, endPoint)
    if (!startPoint || !endPoint) {
      return {}
    }
    let left = Math.min(startPoint.x, endPoint.x)
    let top = Math.min(startPoint.y, endPoint.y)
    let width = Math.abs(startPoint.x - endPoint.x)
    let height = Math.abs(startPoint.y - endPoint.y)
    return {
      width,
      height,
      left,
      top
    }
  }

  render() {
    let {style, className} = this.props
    let maskStyle = this.computeMaskPosition()
    const styles = {
      position: 'absolute',
      background: 'rgba(199, 207, 254, 0.3)',
      border: 'solid 1px rgba(155, 155, 155, 0.56)',
      zIndex: 90,
      cursor: 'crosshair',
      ...maskStyle,
      ...style
    }
    if (!this.state.onDrag || !this.state.endPoint || !this.state.startPoint) {
      return null
    }
    debug('rendeering', styles)
    return (
      <div className={className} style={styles} />
    )
  }

}


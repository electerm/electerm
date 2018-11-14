/**
 * drag to select file/folder
 */

import React from 'react'
import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'

export default class DragSelect extends React.PureComponent {

  static propTypes = {
    className: PropTypes.string,
    wrapperSelector: PropTypes.string,
    targetSelector: PropTypes.string,
    onSelect: PropTypes.func, // (fileIds: [string], e: Event) => ...
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

  destroyEvents() {
    this.root.removeEventListener('mousedown', this.onMousedown)
    clearTimeout(this.mousedownTimer)
  }

  initEvents() {
    let root = document.querySelector(this.props.wrapperSelector)
    if (!root) {
      return
    }
    this.root = root
    this.root.addEventListener('mousedown', this.onMousedown)
    this.root.addEventListener('mouseup', this.onMouseup)
    this.root.addEventListener('contextmenu', this.onContextmenu)
  }

  mousemove = e => {
    let rect = this.root.getBoundingClientRect()
    let endPoint = {
      x: e.pageX - rect.left,
      y: e.pageY - rect.top + 30
    }
    this.setState({
      endPoint
    })
  }

  onMousedown = e => {
    clearTimeout(this.mousedownTimer)
    this.mousedownTimer = setTimeout(() => this.doMouseDown(e), 300)
  }

  doMouseDown = (e) => {
    if (
      !e.target.className.includes('sftp-item') ||
      this.props.onDrag
    ) {
      return
    }
    let rect = this.root.getBoundingClientRect()
    let startPoint = {
      x: e.pageX - rect.left,
      y: e.pageY - rect.top + 30
    }
    this.setState({
      onDrag: true,
      startPoint
    })
    this.root.addEventListener('mousemove', this.mousemove)
  }

  onMouseup = (e) => {
    clearTimeout(this.mousedownTimer)
    this.root.removeEventListener('mousemove', this.mousemove)
    if (
      !this.state.onDrag ||
      !this.state.endPoint ||
      !this.state.startPoint
    ) {
      return
    }
    this.computeSelectedFiles(e)
    this.setState({
      onDrag: false,
      startPoint: null,
      endPoint: null
    })
  }

  onContextmenu = () => {
    clearTimeout(this.mousedownTimer)
    this.root.removeEventListener('mousemove', this.mousemove)
    this.setState({
      onDrag: false,
      startPoint: null,
      endPoint: null
    })
  }

  checkIntersects = (arr1, arr2) => {
    return arr1[0] > arr2[0]
      ? arr1[0] < arr2[1]
      : arr1[1] > arr2[0]
  }

  checkInSelect = (rect, maskReact) => {
    let xs1 = [rect.left, rect.right]
    let ys1 = [rect.top, rect.bottom]
    let xs2 = [maskReact.left, maskReact.right]
    let ys2 = [maskReact.top, maskReact.bottom]
    return this.checkIntersects(xs1, xs2) &&
      this.checkIntersects(ys1, ys2)
  }

  computeSelectedFiles = (e) => {
    let {targetSelector} = this.props
    let doms = Array.from(document.querySelectorAll(targetSelector))
    let maskDom = ReactDOM.findDOMNode(this)
    let maskReact = maskDom.getBoundingClientRect()
    let ids = doms
      .filter(dom => {
        let rect = dom.getBoundingClientRect()
        return this.checkInSelect(rect, maskReact)
      })
      .map(dom => dom.getAttribute('data-id'))
      .filter(d => d)
    this.props.onSelect(ids, e)
  }

  computeMaskPosition = () => {
    let {startPoint, endPoint} = this.state
    if (!startPoint || !endPoint) {
      return {}
    }
    let fix = startPoint.x > endPoint.x
      ? 1
      : -1
    let left = Math.min(startPoint.x, endPoint.x) + fix
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
    if (
      !this.state.onDrag ||
      !this.state.endPoint ||
      !this.state.startPoint
    ) {
      return null
    }
    return (
      <div className={className} style={styles} />
    )
  }

}


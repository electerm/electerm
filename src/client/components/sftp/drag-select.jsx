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

  componentDidMount () {
    this.initEvents()
  }

  componentWillUnmount () {
    this.destroyEvents()
  }

  destroyEvents () {
    this.root.removeEventListener('mousedown', this.onMousedown)
    clearTimeout(this.mousedownTimer)
  }

  initEvents () {
    const root = document.querySelector(this.props.wrapperSelector)
    if (!root) {
      return
    }
    this.root = root
    this.root.addEventListener('mousedown', this.onMousedown)
    this.root.addEventListener('mouseup', this.onMouseup)
    this.root.addEventListener('contextmenu', this.onContextmenu)
  }

  mousemove = e => {
    const rect = this.root.getBoundingClientRect()
    const endPoint = {
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
    const rect = this.root.getBoundingClientRect()
    const startPoint = {
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
    const xs1 = [rect.left, rect.right]
    const ys1 = [rect.top, rect.bottom]
    const xs2 = [maskReact.left, maskReact.right]
    const ys2 = [maskReact.top, maskReact.bottom]
    return this.checkIntersects(xs1, xs2) &&
      this.checkIntersects(ys1, ys2)
  }

  computeSelectedFiles = (e) => {
    const { targetSelector } = this.props
    const doms = Array.from(document.querySelectorAll(targetSelector))
    const maskDom = ReactDOM.findDOMNode(this)
    const maskReact = maskDom.getBoundingClientRect()
    const ids = doms
      .filter(dom => {
        const rect = dom.getBoundingClientRect()
        return this.checkInSelect(rect, maskReact)
      })
      .map(dom => dom.getAttribute('data-id'))
      .filter(d => d)
    this.props.onSelect(ids, e)
  }

  computeMaskPosition = () => {
    const { startPoint, endPoint } = this.state
    if (!startPoint || !endPoint) {
      return {}
    }
    const fix = startPoint.x > endPoint.x
      ? 1
      : -1
    const left = Math.min(startPoint.x, endPoint.x) + fix
    const top = Math.min(startPoint.y, endPoint.y)
    const width = Math.abs(startPoint.x - endPoint.x)
    const height = Math.abs(startPoint.y - endPoint.y)
    return {
      width,
      height,
      left,
      top
    }
  }

  render () {
    const { style, className } = this.props
    const maskStyle = this.computeMaskPosition()
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

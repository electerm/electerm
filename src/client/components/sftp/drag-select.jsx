/**
 * drag to select file/folder
 */


import React from 'react'
import PropTypes from 'prop-types'

export default class Confirms extends React.Component {

  static propTypes = {
    className: PropTypes.string,
    wrapperSelector: PropTypes.string,
    targetSelector: PropTypes.string,
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
    let root = document.querySelector(this.props.wrapperSelector)
    if (!root) {
      return
    }
    this.root = root
    document.addEventListener('mousedown', this.onMousedown)
    document.addEventListener('mouseup', this.onMouseup)
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
    let startPoint = {
      x: e.pageX,
      y: e.pageY
    }
    this.setState({
      onDrag: true,
      startPoint
    })
    document.addEventListener('mousemove', this.mousemove)
  }

  onMouseup = e => {
    document.removeEventListener('mousemove', this.mousemove)
    this.setState({
      onDrag: false,
      startPoint: null,
      endPoint: null
    })
  }

  render() {
    let {style, className} = this.props
    const styles = {
      position: 'absolute',
      background: 'rgba(199, 207, 254, 0.3)',
      border: 'solid 1px rgba(155, 155, 155, 0.56)',
      zIndex: 90,
      cursor: 'crosshair',
      ...this.state.maskStyle,
      ...style
    }
    if (!this.state.onDrag || !this.state.endPoint || !this.state.startPoint) {
      return null
    }
    return (
      <div className={className} style={styles} />
    )
  }

}


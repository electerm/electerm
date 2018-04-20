/**
 * make child component resizable by drag the horizontal or vertical handle
 */

import {Component} from 'react'
//import ReactDOM from 'react-dom'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import {terminalSplitDirectionMap} from '../../common/constants'
import './resize-wrap.styl'

export default class ResizeWrap extends Component {

  static propTypes = {
    direction: PropTypes.oneOf(['horizontal', 'vertical']).isRequired,
    children: PropTypes.arrayOf(PropTypes.element).isRequired
  }

  static defaultProps = {

  }

  componentDidMount() {
    //this.initDnD()
  }

  onDrag = () => {

  }

  onDragEnter = () => {

  }

  onDragExit = () => {

  }

  onDragLeave = () => {

  }

  onDragOver = e => {
    e.preventDefault()
  }

  onDragStart = () => {

  }

  onDrop = async () => {

  }

  onDragEnd = () => {

  }

  onDropFile = (fromFile, toFile) => {
    let {type: fromType} = fromFile
    let {
      type: toType,
      isDirectory: isDirectoryTo
    } = toFile

    //same side and drop to file, do nothing
    if (fromType === toType && !isDirectoryTo) {
      return
    }

    //same side and drop to folder, do mv
    if (fromType === toType && isDirectoryTo) {
      return this.mv(fromFile, toFile)
    }

    //other side, do transfer
    this.transferDrop(fromFile, toFile)

  }

  buildHandleComponent = (prevComponent, direction, index) => {
    let cls = classnames(
      'term-dragger',
      `term-dragger-${index}`,
      `term-dragger-${direction}`
    )
    let {left, top, width, height} = prevComponent.props
    let style = direction === terminalSplitDirectionMap.vertical
      ? {
        left: 0,
        right: 0,
        top: top + height
      } : {
        top: 0,
        bottom: 0,
        left: left + width
      }
    return (
      <span
        className={cls}
        style={style}
      />
    )
  }

  resizeComponent = (prevComponent) => {
    return prevComponent
  }

  render() {
    let {
      children,
      direction
    } = this.props
    let len = children.length
    if (len < 2) {
      return children
    }
    let newArr = children.reduce((prev, c, i) => {
      return [
        ...prev,
        c,
        i === len - 1
          ? null
          : this.buildHandleComponent(c, direction, i)
      ].filter(d => d)
    }, [])
    return newArr
  }
}

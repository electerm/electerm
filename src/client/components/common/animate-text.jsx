
/**
 * animate text when text change
 */

import React from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import './animate-text.styl'

export default class AnimateText extends React.PureComponent {
  static propTypes = {
    className: PropTypes.string
  }

  static defaultProps = {
    className: 'animate-text-wrap'
  }

  componentDidUpdate () {
    const dom = ReactDOM.findDOMNode(this)
    dom.className = this.props.className + ' animated bounceIn'
    this.timer = setTimeout(() => {
      if (dom) {
        dom.className = this.props.className
      }
    }, 450)
  }

  componentWillUnmount () {
    clearTimeout(this.timer)
  }

  render () {
    const { children, className } = this.props
    return (
      <div className={className}>
        {children}
      </div>
    )
  }
}
